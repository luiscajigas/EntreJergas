import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService, AuthUser, Dashboard, ExpressionEntry, HistoryItem } from './api.service';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  entry?: ExpressionEntry;
  missing?: boolean;
  offline?: boolean;
}

interface WorkerCandidate {
  expression: string;
  region: string;
}

interface WorkerResult {
  candidates: WorkerCandidate[];
  checking: boolean;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: Event & { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type AppView = 'chat' | 'history' | 'dashboard';
type ColorTheme = 'light' | 'dark';

function readThemePreference(): ColorTheme {
  try {
    const storedTheme = localStorage.getItem('entrejergas.theme.v1');
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  } catch {
    // El almacenamiento puede estar deshabilitado por el navegador.
  }

  return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-root',
  styleUrl: './app-shell.css',
  templateUrl: './app-shell.html',
  host: { '[attr.data-theme]': 'theme()' },
})
export class App implements OnInit, OnDestroy {
  readonly theme = signal<ColorTheme>(readThemePreference());
  readonly activeView = signal<AppView>('chat');
  readonly currentUser = signal<AuthUser | null>(null);
  readonly authLoading = signal(true);
  readonly authMode = signal<'login' | 'register'>('login');
  readonly authSubmitting = signal(false);
  readonly authError = signal('');
  readonly sidebarOpen = signal(false);
  readonly draft = signal('');
  readonly messages = signal<ChatMessage[]>([]);
  readonly candidates = signal<WorkerCandidate[]>([]);
  readonly history = signal<HistoryItem[]>([]);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly loading = signal(false);
  readonly listening = signal(false);
  readonly apiOnline = signal(false);
  readonly speechSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  authName = '';
  authEmail = '';
  authPassword = '';

  private worker?: Worker;
  private recognition?: SpeechRecognitionLike;
  private messageId = 0;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./regionalism.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
        this.candidates.set(data.candidates);
      };
      this.worker.onerror = () => this.candidates.set([]);
    }
    void this.restoreSession();
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
    this.recognition?.stop();
  }

  onDraftChange(value: string): void {
    this.draft.set(value);
    this.worker?.postMessage(value);
  }

  toggleTheme(): void {
    const nextTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(nextTheme);
    try {
      localStorage.setItem('entrejergas.theme.v1', nextTheme);
    } catch {
      // El tema sigue funcionando aunque no se pueda guardar.
    }
  }

  toggleAuthMode(): void {
    this.authMode.update((mode) => mode === 'login' ? 'register' : 'login');
    this.authError.set('');
  }

  async submitAuth(): Promise<void> {
    if (this.authSubmitting()) return;

    this.authSubmitting.set(true);
    this.authError.set('');
    try {
      const result = this.authMode() === 'register'
        ? await firstValueFrom(this.api.register(this.authName, this.authEmail, this.authPassword))
        : await firstValueFrom(this.api.login(this.authEmail, this.authPassword));
      this.currentUser.set(result.user);
      this.authPassword = '';
      await this.refreshPanels();
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = (error as { error?: { error?: string } }).error?.error;
      this.authError.set(message || (status === 401
        ? 'Correo o contraseña incorrectos.'
        : 'No fue posible iniciar sesión. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      this.authSubmitting.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } catch {
      // La interfaz se cierra aunque el servidor no esté disponible.
    }
    this.currentUser.set(null);
    this.history.set([]);
    this.dashboard.set(null);
    this.messages.set([]);
    this.draft.set('');
    this.candidates.set([]);
    this.worker?.postMessage('');
    this.activeView.set('chat');
  }

  useCandidate(candidate: WorkerCandidate): void {
    this.onDraftChange(candidate.expression);
  }

  async submit(): Promise<void> {
    const expression = this.draft().trim();
    if (!expression || this.loading()) return;

    this.activeView.set('chat');
    this.sidebarOpen.set(false);
    this.messages.update((items) => [...items, {
      id: ++this.messageId,
      role: 'user',
      text: expression
    }]);
    this.draft.set('');
    this.candidates.set([]);
    this.worker?.postMessage('');
    this.loading.set(true);

    try {
      const result = await firstValueFrom(this.api.lookup(expression));
      this.apiOnline.set(true);
      if (result.entry) this.saveCachedEntry(result.entry);
      this.messages.update((items) => [...items, result.entry
        ? { id: ++this.messageId, role: 'assistant', entry: result.entry }
        : { id: ++this.messageId, role: 'assistant', text: result.message, missing: true }
      ]);
      void this.refreshPanels();
    } catch {
      const cachedEntry = this.readCachedEntry(expression);
      this.apiOnline.set(false);
      this.messages.update((items) => [...items, cachedEntry
        ? { id: ++this.messageId, role: 'assistant', entry: cachedEntry, offline: true }
        : {
            id: ++this.messageId,
            role: 'assistant',
            text: 'No pude conectar con el diccionario. La consulta quedó en esta conversación; revisa tu conexión e inténtalo de nuevo.',
            missing: true
          }
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  startNewChat(): void {
    this.activeView.set('chat');
    this.messages.set([]);
    this.onDraftChange('');
    this.sidebarOpen.set(false);
  }

  openView(view: AppView): void {
    this.activeView.set(view);
    this.sidebarOpen.set(false);
    if (view === 'history') void this.loadHistory();
    if (view === 'dashboard') void this.loadDashboard();
  }

  openHistoryItem(item: HistoryItem): void {
    this.activeView.set('chat');
    this.onDraftChange(item.expression);
    void this.submit();
  }

  toggleDictation(): void {
    if (this.listening()) {
      this.recognition?.stop();
      return;
    }

    const speechApi = window as SpeechWindow;
    const Recognition = speechApi.SpeechRecognition || speechApi.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      this.onDraftChange([this.draft(), transcript].filter(Boolean).join(' ').trim());
    };
    recognition.onerror = () => this.listening.set(false);
    recognition.onend = () => this.listening.set(false);
    this.recognition = recognition;
    this.listening.set(true);
    recognition.start();
  }

  private async refreshPanels(): Promise<void> {
    await Promise.all([this.loadHistory(), this.loadDashboard()]);
    try {
      await firstValueFrom(this.api.health());
      this.apiOnline.set(true);
    } catch {
      this.apiOnline.set(false);
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const result = await firstValueFrom(this.api.currentUser());
      this.currentUser.set(result.user);
      await this.refreshPanels();
    } catch {
      this.currentUser.set(null);
    } finally {
      this.authLoading.set(false);
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      this.history.set((await firstValueFrom(this.api.history())).items);
    } catch {
      this.history.set([]);
    }
  }

  private async loadDashboard(): Promise<void> {
    try {
      this.dashboard.set(await firstValueFrom(this.api.dashboard()));
    } catch {
      this.dashboard.set(null);
    }
  }

  private saveCachedEntry(entry: ExpressionEntry): void {
    try {
      const cache = this.readCache();
      cache[this.cacheKey(entry.expression)] = entry;
      localStorage.setItem('entrejergas.entries.v1', JSON.stringify(cache));
    } catch {
      // El almacenamiento local puede estar deshabilitado por el navegador.
    }
  }

  private readCachedEntry(expression: string): ExpressionEntry | null {
    try {
      return this.readCache()[this.cacheKey(expression)] ?? null;
    } catch {
      return null;
    }
  }

  private readCache(): Record<string, ExpressionEntry> {
    return JSON.parse(localStorage.getItem('entrejergas.entries.v1') || '{}') as Record<string, ExpressionEntry>;
  }

  private cacheKey(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  }
}
