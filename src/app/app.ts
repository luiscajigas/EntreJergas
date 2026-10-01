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
type AppLanguage = 'es' | 'en';
type TranslationKey =
  | 'auth.loading'
  | 'auth.kicker'
  | 'auth.title.login'
  | 'auth.title.register'
  | 'auth.intro.login'
  | 'auth.intro.register'
  | 'auth.name'
  | 'auth.email'
  | 'auth.password'
  | 'auth.submit.login'
  | 'auth.submit.register'
  | 'auth.submit.pending'
  | 'auth.switch.login'
  | 'auth.switch.register'
  | 'auth.switch.action.login'
  | 'auth.switch.action.register'
  | 'nav.newChat'
  | 'nav.explore'
  | 'nav.history'
  | 'nav.dictionary'
  | 'nav.recent'
  | 'nav.betaTitle'
  | 'nav.betaText'
  | 'nav.logout'
  | 'topbar.chat'
  | 'topbar.history'
  | 'topbar.dictionary'
  | 'topbar.newConversation'
  | 'topbar.summary'
  | 'status.connected'
  | 'status.offline'
  | 'welcome.kicker'
  | 'welcome.title'
  | 'welcome.copy'
  | 'search.try'
  | 'suggestion.parcero.use'
  | 'suggestion.chimba.use'
  | 'suggestion.chichai.use'
  | 'suggestion.papaya.use'
  | 'suggestion.parcero.origin'
  | 'suggestion.chimba.origin'
  | 'suggestion.chichai.origin'
  | 'suggestion.papaya.origin'
  | 'beta.note'
  | 'message.user'
  | 'message.result.saved'
  | 'message.result.found'
  | 'detail.equivalent'
  | 'detail.phrase'
  | 'detail.pronunciation'
  | 'audio.play'
  | 'notfound.title'
  | 'notfound.subtitle'
  | 'thinking.searching'
  | 'candidate.caption'
  | 'composer.placeholder'
  | 'composer.hint'
  | 'composer.mic.start'
  | 'composer.mic.stop'
  | 'composer.mic.unsupported'
  | 'composer.send'
  | 'composer.disclaimer'
  | 'history.kicker'
  | 'history.heading'
  | 'history.subheading'
  | 'history.table.expression'
  | 'history.table.result'
  | 'history.table.date'
  | 'history.found'
  | 'history.notFound'
  | 'history.empty.title'
  | 'history.empty.text'
  | 'history.empty.button'
  | 'dashboard.kicker'
  | 'dashboard.heading'
  | 'dashboard.subheading'
  | 'dashboard.expressions'
  | 'dashboard.expressions.label'
  | 'dashboard.searches'
  | 'dashboard.searches.label'
  | 'dashboard.regions'
  | 'dashboard.regions.label'
  | 'dashboard.loading'
  | 'dashboard.region.title'
  | 'dashboard.region.expression'
  | 'dictionary.note.title'
  | 'dictionary.note.body'
  | 'footer.tagline'
  | 'language.toggle.aria'
  | 'theme.toggle.light'
  | 'theme.toggle.dark';

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

function readLanguagePreference(): AppLanguage {
  try {
    const storedLanguage = localStorage.getItem('entrejergas.language.v1');
    if (storedLanguage === 'es' || storedLanguage === 'en') return storedLanguage;
  } catch {
    // El idioma sigue funcionando aunque no se pueda guardar.
  }

  return 'es';
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
  readonly language = signal<AppLanguage>(readLanguagePreference());
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

  private readonly translations: Record<AppLanguage, Record<TranslationKey, string>> = {
    es: {
      'auth.loading': 'Preparando tu espacio…',
      'auth.kicker': 'UN LUGAR PARA LAS PALABRAS',
      'auth.title.login': 'Qué bueno verte.',
      'auth.title.register': 'Tu espacio empieza aquí.',
      'auth.intro.login': 'Entra para continuar explorando expresiones.',
      'auth.intro.register': 'Crea una cuenta para guardar tu recorrido.',
      'auth.name': 'Nombre',
      'auth.email': 'Correo electrónico',
      'auth.password': 'Contraseña',
      'auth.submit.login': 'Iniciar sesión',
      'auth.submit.register': 'Crear cuenta',
      'auth.submit.pending': 'Un momento…',
      'auth.switch.login': '¿Todavía no tienes cuenta?',
      'auth.switch.register': '¿Ya tienes una cuenta?',
      'auth.switch.action.login': 'Regístrate',
      'auth.switch.action.register': 'Inicia sesión',
      'nav.newChat': 'Nueva consulta',
      'nav.explore': 'Explorar expresiones',
      'nav.history': 'Historial',
      'nav.dictionary': 'Diccionario',
      'nav.recent': 'CONSULTAS RECIENTES',
      'nav.betaTitle': 'Diccionario vivo',
      'nav.betaText': 'Las palabras también cuentan de dónde venimos.',
      'nav.logout': 'Salir',
      'topbar.chat': 'Laboratorio de palabras',
      'topbar.history': 'Tu recorrido',
      'topbar.dictionary': 'El diccionario',
      'topbar.newConversation': 'Nueva conversación',
      'topbar.summary': 'Resumen',
      'status.connected': 'Conectado',
      'status.offline': 'Sin conexión',
      'welcome.kicker': 'PALABRAS CON ACENTO PROPIO',
      'welcome.title': '¿Qué significa\neso que dijeron?',
      'welcome.copy': 'Cada región tiene su manera de nombrar el mundo.\nEscribe una expresión y descubramos su historia.',
      'search.try': 'Prueba con una expresión',
      'suggestion.parcero.use': '¿Cómo se usa?',
      'suggestion.chimba.use': '¿De dónde viene?',
      'suggestion.chichai.use': '¿Te suena?',
      'suggestion.papaya.use': 'Una frase colombiana',
      'suggestion.parcero.origin': '¿Cómo se usa?',
      'suggestion.chimba.origin': '¿De dónde viene?',
      'suggestion.chichai.origin': '¿Te suena?',
      'suggestion.papaya.origin': 'Una frase colombiana',
      'beta.note': 'Beta en construcción • Sin inteligencia artificial por ahora',
      'message.user': 'TU CONSULTA',
      'message.result.saved': 'GUARDADO EN ESTE DISPOSITIVO',
      'message.result.found': 'ENCONTRADO EN EL DICCIONARIO',
      'detail.equivalent': 'EN OTRAS PALABRAS',
      'detail.phrase': 'EN UNA FRASE',
      'detail.pronunciation': 'PRONUNCIACIÓN',
      'audio.play': 'Reproducir pronunciación',
      'notfound.title': 'Aún no está en el diccionario',
      'notfound.subtitle': 'Las nuevas expresiones se podrán sumar en una próxima versión.',
      'thinking.searching': 'Consultando el diccionario',
      'candidate.caption': '¿Te refieres a?',
      'composer.placeholder': 'Escribe una palabra o frase…',
      'composer.hint': 'Detectamos regionalismos mientras escribes',
      'composer.mic.start': 'Dictar expresión',
      'composer.mic.stop': 'Detener dictado',
      'composer.mic.unsupported': 'Dictado no compatible con este navegador',
      'composer.send': 'Consultar expresión',
      'composer.disclaimer': 'Las definiciones de esta beta provienen de un diccionario local. Verifica siempre el contexto regional.',
      'history.kicker': 'TU RECORRIDO',
      'history.heading': 'Palabras que ya exploraste',
      'history.subheading': 'Vuelve a una consulta y mírala con otros ojos.',
      'history.table.expression': 'EXPRESIÓN',
      'history.table.result': 'RESULTADO',
      'history.table.date': 'FECHA',
      'history.found': 'En diccionario',
      'history.notFound': 'Sin coincidencia',
      'history.empty.title': 'Aquí empieza tu recorrido',
      'history.empty.text': 'Cuando consultes una expresión, aparecerá en esta lista.',
      'history.empty.button': 'Hacer una consulta',
      'dashboard.kicker': 'EL MAPA DE LAS PALABRAS',
      'dashboard.heading': 'Un diccionario que crece',
      'dashboard.subheading': 'Un vistazo a las expresiones y regiones que ya viven aquí.',
      'dashboard.expressions': 'EXPRESIONES',
      'dashboard.expressions.label': 'en el diccionario',
      'dashboard.searches': 'CONSULTAS',
      'dashboard.searches.label': 'hechas hasta ahora',
      'dashboard.regions': 'REGIONES',
      'dashboard.regions.label': 'representadas',
      'dashboard.loading': 'Las métricas aparecen cuando el servidor está conectado.',
      'dashboard.region.title': 'REGIONES REPRESENTADAS',
      'dashboard.region.expression': 'EXPRESIONES',
      'dictionary.note.title': 'Las palabras cambian según quién las dice.',
      'dictionary.note.body': 'El contexto y la región hacen parte de cada definición.',
      'footer.tagline': 'Hecho para escuchar mejor',
      'language.toggle.aria': 'Cambiar idioma',
      'theme.toggle.light': 'Activar modo claro',
      'theme.toggle.dark': 'Activar modo oscuro'
    },
    en: {
      'auth.loading': 'Preparing your space…',
      'auth.kicker': 'A PLACE FOR WORDS',
      'auth.title.login': 'Nice to see you again.',
      'auth.title.register': 'Your space starts here.',
      'auth.intro.login': 'Sign in to keep exploring expressions.',
      'auth.intro.register': 'Create an account to keep your journey.',
      'auth.name': 'Name',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.submit.login': 'Sign in',
      'auth.submit.register': 'Create account',
      'auth.submit.pending': 'One moment…',
      'auth.switch.login': 'Don’t have an account yet?',
      'auth.switch.register': 'Already have an account?',
      'auth.switch.action.login': 'Create one',
      'auth.switch.action.register': 'Sign in',
      'nav.newChat': 'New search',
      'nav.explore': 'Explore expressions',
      'nav.history': 'History',
      'nav.dictionary': 'Dictionary',
      'nav.recent': 'RECENT SEARCHES',
      'nav.betaTitle': 'Living dictionary',
      'nav.betaText': 'Words also tell us where we come from.',
      'nav.logout': 'Log out',
      'topbar.chat': 'Word lab',
      'topbar.history': 'Your journey',
      'topbar.dictionary': 'The dictionary',
      'topbar.newConversation': 'New conversation',
      'topbar.summary': 'Summary',
      'status.connected': 'Connected',
      'status.offline': 'Offline',
      'welcome.kicker': 'WORDS WITH THEIR OWN ACCENT',
      'welcome.title': 'What does it mean\nwhen they say that?',
      'welcome.copy': 'Every region has its own way of naming the world.\nWrite an expression and let’s discover its story.',
      'search.try': 'Try an expression',
      'suggestion.parcero.use': 'How is it used?',
      'suggestion.chimba.use': 'Where does it come from?',
      'suggestion.chichai.use': 'Does it sound familiar?',
      'suggestion.papaya.use': 'A Colombian phrase',
      'suggestion.parcero.origin': 'How is it used?',
      'suggestion.chimba.origin': 'Where does it come from?',
      'suggestion.chichai.origin': 'Does it sound familiar?',
      'suggestion.papaya.origin': 'A Colombian phrase',
      'beta.note': 'Beta in progress • No AI yet',
      'message.user': 'YOUR QUERY',
      'message.result.saved': 'SAVED ON THIS DEVICE',
      'message.result.found': 'FOUND IN THE DICTIONARY',
      'detail.equivalent': 'IN OTHER WORDS',
      'detail.phrase': 'IN A PHRASE',
      'detail.pronunciation': 'PRONUNCIATION',
      'audio.play': 'Play pronunciation',
      'notfound.title': 'Not in the dictionary yet',
      'notfound.subtitle': 'New expressions can be added in a future version.',
      'thinking.searching': 'Checking the dictionary',
      'candidate.caption': 'Did you mean?',
      'composer.placeholder': 'Write a word or phrase…',
      'composer.hint': 'We detect regionalisms while you type',
      'composer.mic.start': 'Dictate expression',
      'composer.mic.stop': 'Stop dictation',
      'composer.mic.unsupported': 'Dictation not supported in this browser',
      'composer.send': 'Look up expression',
      'composer.disclaimer': 'Definitions in this beta come from a local dictionary. Always verify the regional context.',
      'history.kicker': 'YOUR JOURNEY',
      'history.heading': 'Words you already explored',
      'history.subheading': 'Return to a search and revisit it with fresh eyes.',
      'history.table.expression': 'EXPRESSION',
      'history.table.result': 'RESULT',
      'history.table.date': 'DATE',
      'history.found': 'In dictionary',
      'history.notFound': 'No match',
      'history.empty.title': 'This is where your journey begins',
      'history.empty.text': 'When you look up an expression, it will appear in this list.',
      'history.empty.button': 'Make a search',
      'dashboard.kicker': 'THE MAP OF WORDS',
      'dashboard.heading': 'A dictionary that grows',
      'dashboard.subheading': 'A quick look at the expressions and regions already here.',
      'dashboard.expressions': 'EXPRESSIONS',
      'dashboard.expressions.label': 'in the dictionary',
      'dashboard.searches': 'SEARCHES',
      'dashboard.searches.label': 'made so far',
      'dashboard.regions': 'REGIONS',
      'dashboard.regions.label': 'represented',
      'dashboard.loading': 'Metrics appear when the server is connected.',
      'dashboard.region.title': 'REGIONS REPRESENTED',
      'dashboard.region.expression': 'EXPRESSIONS',
      'dictionary.note.title': 'Words change depending on who says them.',
      'dictionary.note.body': 'Context and region are part of every definition.',
      'footer.tagline': 'Made to listen better',
      'language.toggle.aria': 'Change language',
      'theme.toggle.light': 'Activate light mode',
      'theme.toggle.dark': 'Activate dark mode'
    }
  };

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

  t(key: TranslationKey): string {
    return this.translations[this.language()][key] ?? this.translations.es[key];
  }

  toggleLanguage(): void {
    const nextLanguage = this.language() === 'es' ? 'en' : 'es';
    this.language.set(nextLanguage);
    try {
      localStorage.setItem('entrejergas.language.v1', nextLanguage);
    } catch {
      // El idioma sigue funcionando aunque no se pueda guardar.
    }
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
