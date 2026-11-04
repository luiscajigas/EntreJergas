import { CommonModule, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService, AuthUser, Dashboard, ExpressionEntry, HistoryItem } from './core/api/api.service';
import { TranslationKey } from './core/i18n/i18n';
import { I18nService } from './core/i18n/i18n.service';
import { EntryCard } from './shared/entry-card/entry-card';
import { Icon, IconName } from './shared/icon';
import { Logo } from './shared/logo';

interface Lookup {
  id: number;
  query: string;
  entry?: ExpressionEntry;
  text?: string;
  missing?: boolean;
  offline?: boolean;
  pending?: boolean;
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

registerLocaleData(localeEs);

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
  imports: [CommonModule, EntryCard, FormsModule, Icon, Logo],
  selector: 'app-root',
  styleUrls: ['./styles/layout.css', './styles/search.css', './styles/pages.css', './styles/auth.css'],
  templateUrl: './app-shell.html',
  host: { '[attr.data-theme]': 'theme()', '(document:click)': 'onDocumentClick($event)', '(document:keydown)': 'onDocumentKeydown($event)' },
})
export class App implements OnInit, OnDestroy {
  readonly theme = signal<ColorTheme>(readThemePreference());
  private readonly i18n = inject(I18nService);
  readonly language = this.i18n.language;
  readonly activeView = signal<AppView>('chat');
  readonly currentUser = signal<AuthUser | null>(null);
  readonly authLoading = signal(true);
  readonly authMode = signal<'login' | 'register'>('login');
  readonly authSubmitting = signal(false);
  readonly authError = signal('');
  readonly accountOpen = signal(false);
  readonly draft = signal('');
  readonly lookups = signal<Lookup[]>([]);
  readonly candidates = signal<WorkerCandidate[]>([]);
  readonly history = signal<HistoryItem[]>([]);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly loading = signal(false);
  readonly listening = signal(false);
  readonly apiOnline = signal(false);
  readonly speechSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  readonly suggestions: ReadonlyArray<{ word: string; hint: TranslationKey }> = [
    { word: 'parcero', hint: 'suggestion.parcero.use' },
    { word: 'qué chimba', hint: 'suggestion.chimba.use' },
    { word: 'chichai', hint: 'suggestion.chichai.use' },
    { word: 'dar papaya', hint: 'suggestion.papaya.use' }
  ];

  authName = '';
  authEmail = '';
  authPassword = '';

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private worker?: Worker;
  private recognition?: SpeechRecognitionLike;
  private lookupId = 0;

  constructor(private readonly api: ApiService) {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#18227a' : '#1c2fa8');
    });
    effect(() => {
      document.documentElement.lang = this.language();
    });
  }

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

  onDocumentClick(event: Event): void {
    if (!(event.target as Element | null)?.closest?.('.account')) this.accountOpen.set(false);
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.accountOpen.set(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && this.currentUser()) {
      event.preventDefault();
      this.activeView.set('chat');
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }

  onDraftChange(value: string): void {
    this.draft.set(value);
    this.worker?.postMessage(value);
  }

  t(key: TranslationKey): string {
    return this.i18n.t(key);
  }

  toggleLanguage(): void {
    this.i18n.toggle();
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
        ? this.t('auth.error.credentials')
        : this.t('auth.error.network')));
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
    this.accountOpen.set(false);
    this.history.set([]);
    this.dashboard.set(null);
    this.lookups.set([]);
    this.draft.set('');
    this.candidates.set([]);
    this.worker?.postMessage('');
    this.activeView.set('chat');
  }

  historyStatus(item: HistoryItem): { icon: IconName; label: TranslationKey } {
    switch (item.source) {
      case 'ai_saved': return { icon: 'book', label: 'history.aiSaved' };
      case 'ai': return { icon: 'pen', label: 'history.ai' };
      case 'not_found': return { icon: 'help', label: 'history.notFound' };
      default: return { icon: 'check', label: 'history.found' };
    }
  }

  tryWord(word: string): void {
    this.onDraftChange(word);
    void this.submit();
  }

  useCandidate(candidate: WorkerCandidate): void {
    this.onDraftChange(candidate.expression);
  }

  async submit(): Promise<void> {
    const expression = this.draft().trim();
    if (!expression || this.loading()) return;

    this.activeView.set('chat');
    const id = ++this.lookupId;
    this.lookups.update((items) => [{ id, query: expression, pending: true }, ...items]);
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: 'smooth' });
    this.draft.set('');
    this.candidates.set([]);
    this.worker?.postMessage('');
    this.loading.set(true);

    try {
      const result = await firstValueFrom(this.api.lookup(expression));
      this.apiOnline.set(true);
      if (result.entry?.source === 'database') this.saveCachedEntry(result.entry);
      this.resolveLookup(id, result.entry
        ? { entry: result.entry }
        : { text: result.message, missing: true });
      void this.refreshPanels();
    } catch {
      const cachedEntry = this.readCachedEntry(expression);
      this.apiOnline.set(false);
      this.resolveLookup(id, cachedEntry
        ? { entry: cachedEntry, offline: true }
        : { text: this.t('lookup.offline'), missing: true });
    } finally {
      this.loading.set(false);
    }
  }

  startNewChat(): void {
    this.activeView.set('chat');
    this.lookups.set([]);
    this.onDraftChange('');
  }

  openView(view: AppView): void {
    this.activeView.set(view);
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

  private resolveLookup(id: number, patch: Partial<Lookup>): void {
    this.lookups.update((items) => items.map((item) => item.id === id ? { ...item, ...patch, pending: false } : item));
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
