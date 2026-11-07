import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { ApiService, ExpressionEntry, ExpressionPage, LookupResponse } from './core/api/api.service';
import { sessionExpiredInterceptor } from './core/api/session-expired.interceptor';
import { SessionStore } from './core/session.store';
import { EntryCacheService } from './features/search/entry-cache.service';
import { findCandidates } from './features/search/candidates/candidate-matcher';
import { CandidatesService } from './features/search/candidates/candidates.service';
import { SearchStore } from './features/search/search.store';

const ana = { id: 1, email: 'ana@example.com', name: 'Ana' };
const parcero: ExpressionEntry = {
  id: 1,
  expression: 'parcero',
  meaning: 'Amigo cercano.',
  region: 'Antioquia',
  context: 'Informal',
  equivalent: 'amigo',
  example: 'Mi parcero.',
  pronunciation: null,
  audioUrl: null,
  source: 'database',
  countries: ['CO'],
  register: 'informal'
};

const foundResponse = (...entries: ExpressionEntry[]): LookupResponse => ({ found: true, entry: entries[0], entries, unresolved: [] });
const emptyResponse = (fields: Partial<LookupResponse> = {}): LookupResponse => ({ found: false, entry: null, entries: [], unresolved: [], ...fields });

function createApi(signedIn: boolean) {
  return {
    currentUser: () => signedIn ? of({ user: ana }) : throwError(() => new HttpErrorResponse({ status: 401 })),
    login: () => of({ user: ana }),
    register: () => of({ user: ana }),
    logout: () => of(undefined),
    history: () => of({ items: [] }),
    dashboard: () => of({ expressions: 16, searches: 0, regions: [], countries: [{ country: 'AR', count: 3 }, { country: 'CO', count: 2 }] }),
    lookup: (): ReturnType<ApiService['lookup']> => of(emptyResponse({ reason: 'not_found' })),
    searchExpressions: (): ReturnType<ApiService['searchExpressions']> => of({ items: [parcero, { ...parcero, id: 2, expression: 'parce' }], total: 2, page: 1, pageSize: 20 }),
    gameRound: (): ReturnType<ApiService['gameRound']> => of({ round: { id: 1, expression: 'parcero', options: ['AR', 'CO', 'MX', 'ES'] } }),
    gameAnswer: (id: number, country: string): ReturnType<ApiService['gameAnswer']> => of({ correct: country === 'CO', entry: parcero }),
    translate: () => of({ translation: { meaning: 'A close friend', region: 'Antioquia', context: 'Informal', equivalent: 'buddy', example: 'My parcero helped me.' } })
  };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  fixture.detectChanges();
}

async function renderApp({ signedIn = true, language = 'es', url = '/' } = {}) {
  localStorage.setItem('entrejergas.language.v1', language);
  localStorage.setItem('entrejergas.theme.v1', 'light');
  localStorage.removeItem('entrejergas.entries.v2');

  TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter(routes), { provide: ApiService, useValue: createApi(signedIn) }]
  });

  const fixture = TestBed.createComponent(App);
  await settle(fixture);
  if (signedIn) {
    await TestBed.inject(Router).navigateByUrl(url);
    await settle(fixture);
  }

  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, api: TestBed.inject(ApiService), search: TestBed.inject(SearchStore), session: TestBed.inject(SessionStore) };
}

afterEach(() => {
  localStorage.setItem('entrejergas.language.v1', 'es');
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('muestra el espacio de trabajo a quien tiene sesión', async () => {
    const { fixture, element } = await renderApp();

    expect(element.querySelector('.brand-name')?.textContent).toContain('entrejergas');
    expect(element.querySelector('.brand-mark .brand-logo')).toBeTruthy();
    expect(element.querySelector('input[name="expression"]')?.getAttribute('aria-label')).toContain('expresión regional');

    (element.querySelector('.account-button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(element.querySelector('.profile-details')?.textContent).toContain('ana@example.com');
  });

  it('muestra el ingreso sin sesión y permite pasar al registro', async () => {
    const { fixture, element } = await renderApp({ signedIn: false });

    expect(element.querySelector('.auth-panel')).toBeTruthy();
    expect(element.querySelector('.auth-story h1')?.textContent).toContain('Aquí nadie se queda');
    expect(element.querySelector('input[name="name"]')).toBeNull();

    (element.querySelector('.auth-switch button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(element.querySelector('input[name="name"]')).toBeTruthy();
  });

  it('entra a la aplicación al iniciar sesión y vuelve al ingreso al salir', async () => {
    const { fixture, element } = await renderApp({ signedIn: false });

    (element.querySelector('.auth-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(element.querySelector('.app-header')).toBeTruthy();

    (element.querySelector('.account-button') as HTMLButtonElement).click();
    await settle(fixture);
    (element.querySelector('.logout-button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(element.querySelector('.auth-panel')).toBeTruthy();
  });

  it('muestra la cuenta de prueba y entra con un clic', async () => {
    const { fixture, element, api } = await renderApp({ signedIn: false });
    const login = vi.spyOn(api, 'login');
    const box = element.querySelector('.demo-box') as HTMLElement;
    expect(box.textContent).toContain('test@gmail.com');
    expect(box.textContent).toContain('12345677');

    (box.querySelector('button') as HTMLButtonElement).click();
    await settle(fixture);

    expect(login).toHaveBeenCalledWith('test@gmail.com', '12345677');
    expect(element.querySelector('.app-header')).toBeTruthy();
  });

  it('traduce el motivo cuando las credenciales son incorrectas', async () => {
    const { fixture, element, api } = await renderApp({ signedIn: false, language: 'en' });
    vi.spyOn(api, 'login').mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { error: 'Correo o contraseña incorrectos.' } })));

    (element.querySelector('.auth-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await settle(fixture);

    expect(element.querySelector('.auth-error')?.textContent).toContain('Incorrect email or password');
  });

  it('cambia el tema y lo recuerda', async () => {
    const { fixture, element } = await renderApp();
    const button = element.querySelector('.theme-toggle') as HTMLButtonElement;
    expect(document.documentElement.dataset['theme']).toBe('light');

    button.click();
    await settle(fixture);

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Activar modo claro');
    expect(localStorage.getItem('entrejergas.theme.v1')).toBe('dark');
  });

  it('cambia el idioma de la interfaz y lo recuerda', async () => {
    const { fixture, element } = await renderApp();
    expect(element.querySelector('.tabs')?.textContent).toContain('Historial');

    (element.querySelector('.lang-toggle') as HTMLButtonElement).click();
    await settle(fixture);

    expect(element.querySelector('.tabs')?.textContent).toContain('History');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('entrejergas.language.v1')).toBe('en');
  });

  it('abre cada vista en su propia dirección', async () => {
    const { fixture, element } = await renderApp({ url: '/historial' });
    expect(element.querySelector('.history-list, .empty-state')).toBeTruthy();
    expect(element.querySelector('.tabs a.selected')?.textContent).toContain('Historial');

    await TestBed.inject(Router).navigateByUrl('/diccionario');
    await settle(fixture);
    expect(element.querySelector('.stats')?.textContent).toContain('16');
    expect(element.querySelector('.region-list')?.textContent).toContain('Argentina');
    expect(element.querySelector('.word-rows')?.textContent).toContain('parce');
  });

  it('lleva a la búsqueda con Ctrl K desde cualquier vista', async () => {
    const { fixture, element } = await renderApp({ url: '/historial' });
    document.body.appendChild(element);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe('/');
    expect(document.activeElement?.getAttribute('name')).toBe('expression');
    element.remove();
  });

  it('cierra el menú de cuenta con Escape', async () => {
    const { fixture, element } = await renderApp();
    (element.querySelector('.account-button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(element.querySelector('.account-menu')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(fixture);

    expect(element.querySelector('.account-menu')).toBeNull();
  });
});

describe('Búsqueda', () => {
  it('pone arriba el resultado más reciente', async () => {
    const { fixture, element, search, api } = await renderApp();
    const lookup = vi.spyOn(api, 'lookup');

    await search.search('parcero');
    await search.search('chichai');
    await settle(fixture);

    expect(lookup).toHaveBeenCalledWith('parcero');
    expect(search.lookups().map((item) => item.query)).toEqual(['chichai', 'parcero']);
    expect(element.querySelector('.missing-body h2')?.textContent).toContain('chichai');
  });

  it('etiqueta el origen de la definición y solo guarda en caché las del diccionario', async () => {
    const { fixture, element, search, api } = await renderApp();
    const lookup = vi.spyOn(api, 'lookup');

    lookup.mockReturnValue(of(foundResponse({ ...parcero, id: null, expression: 'palabra nueva', source: 'ai', classification: 'regional' })));
    await search.search('palabra nueva');
    await settle(fixture);
    expect(element.querySelector('.result-eyebrow')?.textContent).toContain('Generado con IA');
    expect(localStorage.getItem('entrejergas.entries.v2')).toBeNull();

    lookup.mockReturnValue(of(foundResponse({ ...parcero, id: 24, expression: 'otra', source: 'ai' })));
    await search.search('“otra”');
    await settle(fixture);
    expect(element.querySelector('.result-eyebrow')?.textContent).toContain('agregado al diccionario');
  });

  it('muestra una ficha por expresión de la frase y sugiere la forma correcta', async () => {
    const { fixture, element, search, api } = await renderApp();
    const mochila: ExpressionEntry = { ...parcero, id: null, expression: 'mochila', source: 'ai', countries: [], register: 'neutral', classification: 'common' };
    const lookup = vi.spyOn(api, 'lookup').mockReturnValue(of({
      ...foundResponse(parcero, mochila),
      unresolved: [{ text: 'parzero', reason: 'typo', suggestion: 'parcero' }, { text: 'trompicho', reason: 'unknown', suggestion: null }]
    }));

    await search.search('qué significa parcero, mochila, parzero y trompicho');
    await settle(fixture);

    const labels = Array.from(element.querySelectorAll('.result-eyebrow')).map((item) => item.textContent);
    expect(labels[0]).toContain('En el diccionario');
    expect(labels[1]).toContain('Palabra común');
    const unresolved = element.querySelectorAll('.unresolved-card');
    expect(unresolved.length).toBe(2);
    expect(unresolved[1].textContent).toContain('No reconocemos');

    lookup.mockClear();
    (unresolved[0].querySelector('button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(lookup).toHaveBeenCalledWith('parcero');
  });

  it('muestra el país en el idioma elegido y avisa si la palabra puede ofender', async () => {
    const { fixture, element, search, api } = await renderApp();
    const boludo: ExpressionEntry = { ...parcero, expression: 'boludo', region: 'Río de la Plata', countries: ['AR', 'ES'], register: 'vulgar' };
    vi.spyOn(api, 'lookup').mockReturnValue(of(foundResponse(boludo)));

    await search.search('boludo');
    await settle(fixture);
    expect(element.querySelector('.region')?.textContent).toContain('Argentina · España · Río de la Plata');
    expect(element.querySelector('.register-badge')?.textContent).toContain('Puede ser ofensiva');

    (element.querySelector('.lang-toggle') as HTMLButtonElement).click();
    await settle(fixture);
    expect(element.querySelector('.region')?.textContent).toContain('Spain');
  });

  it('muestra el motivo del fallo en el idioma elegido', async () => {
    const { fixture, element, search, api } = await renderApp({ language: 'en' });
    vi.spyOn(api, 'lookup').mockReturnValue(of(emptyResponse({ reason: 'provider_unavailable', message: 'Gemini no pudo responder (error 503).' })));

    await search.search('cachon');
    await settle(fixture);

    expect(element.querySelector('.missing-body p')?.textContent).toContain('The AI could not reply');
  });

  it('muestra el mensaje del servidor si no recibe un motivo', async () => {
    const { fixture, element, search, api } = await renderApp();
    vi.spyOn(api, 'lookup').mockReturnValue(of(emptyResponse({ message: 'Gemini no pudo responder (error 503).' })));

    await search.search('cachon');
    await settle(fixture);

    expect(element.querySelector('.missing-body p')?.textContent).toContain('error 503');
  });

  it('usa la copia local solo si falla la conexión', async () => {
    const { fixture, element, search, api } = await renderApp();
    const lookup = vi.spyOn(api, 'lookup');

    lookup.mockReturnValue(of(foundResponse(parcero)));
    await search.search('parcero');
    lookup.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await search.search('PARCERO');
    await settle(fixture);
    expect(element.querySelector('.result-eyebrow')?.textContent).toContain('Guardada en este dispositivo');
    expect(element.querySelector('.offline-pill')).toBeTruthy();

    lookup.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    await search.search('parcero');
    await settle(fixture);
    expect(element.querySelector('.missing-body p')?.textContent).toContain('no aceptó');
  });
});

describe('Explorar el diccionario', () => {
  it('lee los filtros de la URL y los envía a la API', async () => {
    const { element, api } = await renderApp({ url: '/diccionario' });
    const search = vi.spyOn(api, 'searchExpressions');
    await TestBed.inject(Router).navigateByUrl('/diccionario?q=bol&pais=AR&pagina=2');
    await new Promise((resolve) => setTimeout(resolve));

    expect(search).toHaveBeenLastCalledWith({ q: 'bol', country: 'AR', page: 2, pageSize: 20 });
    expect(element).toBeTruthy();
  });

  it('busca al escribir, sin enviar una consulta por cada letra', async () => {
    const { fixture, element, api } = await renderApp({ url: '/diccionario' });
    const search = vi.spyOn(api, 'searchExpressions');
    const input = element.querySelector('input[name="dictionary-search"]') as HTMLInputElement;

    for (const value of ['p', 'pa', 'par']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await new Promise((resolve) => setTimeout(resolve, 320));
    await settle(fixture);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].q).toBe('par');
    expect(TestBed.inject(Router).url).toContain('q=par');
  });

  it('filtra por país con la lista lateral y lo quita al repetir', async () => {
    const { fixture, element } = await renderApp({ url: '/diccionario' });
    const row = () => element.querySelector('.region-row') as HTMLButtonElement;

    row().click();
    await settle(fixture);
    expect(TestBed.inject(Router).url).toContain('pais=AR');
    expect(row().getAttribute('aria-pressed')).toBe('true');

    row().click();
    await settle(fixture);
    expect(TestBed.inject(Router).url).not.toContain('pais=');
  });

  it('abre la ficha al tocar una palabra', async () => {
    const { fixture, element } = await renderApp({ url: '/diccionario' });
    expect(element.querySelector('app-entry-card')).toBeNull();

    (element.querySelector('.word-row') as HTMLButtonElement).click();
    await settle(fixture);

    expect(element.querySelector('app-entry-card .headword')?.textContent).toContain('parcero');
    expect(element.querySelector('.word-row')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('ignora una respuesta vieja que llega después de la más reciente', async () => {
    const { fixture, element, api } = await renderApp({ url: '/diccionario' });
    const slow = new Subject<ExpressionPage>();
    const search = vi.spyOn(api, 'searchExpressions');
    search.mockReturnValueOnce(slow);
    search.mockReturnValueOnce(of({ items: [{ ...parcero, expression: 'reciente' }], total: 1, page: 1, pageSize: 20 }));

    await TestBed.inject(Router).navigateByUrl('/diccionario?q=vieja');
    await settle(fixture);
    await TestBed.inject(Router).navigateByUrl('/diccionario?q=reciente');
    await settle(fixture);
    slow.next({ items: [{ ...parcero, expression: 'vieja' }], total: 1, page: 1, pageSize: 20 });
    slow.complete();
    await settle(fixture);

    expect(element.querySelector('.word-rows')?.textContent).toContain('reciente');
    expect(element.querySelector('.word-rows')?.textContent).not.toContain('vieja');
  });

  it('avisa si no hay resultados y permite quitar los filtros', async () => {
    const { fixture, element, api } = await renderApp({ url: '/diccionario' });
    vi.spyOn(api, 'searchExpressions').mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 }));

    await TestBed.inject(Router).navigateByUrl('/diccionario?q=nada');
    await settle(fixture);
    expect(element.querySelector('.explore-state')?.textContent).toContain('No encontramos');

    (element.querySelector('.explore-state button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/diccionario');
  });

  it('permite reintentar si falla la carga', async () => {
    const { fixture, element, api } = await renderApp({ url: '/diccionario' });
    const search = vi.spyOn(api, 'searchExpressions').mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

    await TestBed.inject(Router).navigateByUrl('/diccionario?q=error');
    await settle(fixture);
    expect(element.querySelector('.explore-state')?.textContent).toContain('No pudimos cargar');

    (element.querySelector('.explore-state button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(search).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.word-rows')).toBeTruthy();
  });
});

describe('Juego', () => {
  const options = (element: HTMLElement) => Array.from(element.querySelectorAll<HTMLButtonElement>('button.game-option'));

  it('suma puntos y racha al acertar, y muestra la ficha', async () => {
    localStorage.removeItem('entrejergas.game.best.v1');
    const { fixture, element } = await renderApp({ url: '/jugar' });
    expect(element.querySelector('.game-word')?.textContent).toContain('parcero');
    expect(options(element).map((button) => button.textContent?.trim())).toEqual(['Argentina', 'Colombia', 'México', 'España']);
    expect(element.querySelector('app-entry-card')).toBeNull();

    options(element)[1].click();
    await settle(fixture);

    expect(element.querySelector('.game-verdict')?.textContent).toContain('Correcto');
    expect(element.querySelector('.scoreboard')?.textContent).toContain('1/1');
    expect(element.querySelector('app-entry-card .meaning')?.textContent).toContain('Amigo cercano');
    expect(localStorage.getItem('entrejergas.game.best.v1')).toBe('1');
  });

  it('marca el error, reinicia la racha y conserva la mejor', async () => {
    localStorage.setItem('entrejergas.game.best.v1', '4');
    const { fixture, element } = await renderApp({ url: '/jugar' });

    options(element)[0].click();
    await settle(fixture);

    expect(element.querySelector('.game-verdict')?.textContent).toContain('Esta vez no');
    expect(element.querySelector('.game-option.is-wrong')?.textContent).toContain('Argentina');
    expect(element.querySelector('.game-option.is-correct')?.textContent).toContain('Colombia');
    expect(element.querySelector('.scoreboard')?.textContent).toContain('0/1');
    expect(element.querySelector('.scoreboard')?.textContent).toContain('4');
  });

  it('pasa a la siguiente palabra sin repetir la anterior', async () => {
    const { fixture, element, api } = await renderApp({ url: '/jugar' });
    const round = vi.spyOn(api, 'gameRound');

    options(element)[1].click();
    await settle(fixture);
    (element.querySelector('.game-next') as HTMLButtonElement).click();
    await settle(fixture);

    expect(round).toHaveBeenLastCalledWith([1]);
    expect(options(element).length).toBe(4);
  });

  it('cuenta una sola respuesta aunque se toque dos veces', async () => {
    const { fixture, element, api } = await renderApp({ url: '/jugar' });
    const answer = vi.spyOn(api, 'gameAnswer');

    const [first] = options(element);
    first.click();
    first.click();
    await settle(fixture);

    expect(answer).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.scoreboard')?.textContent).toContain('/1');
  });

  it('explica cuando no hay palabras para jugar', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: ApiService, useValue: { ...createApi(true), gameRound: () => of({ round: null }) } }]
    });
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    await TestBed.inject(Router).navigateByUrl('/jugar');
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelector('.game-message')?.textContent).toContain('Todavía no hay palabras');
  });

  it('muestra los países en el idioma elegido', async () => {
    const { element } = await renderApp({ url: '/jugar', language: 'en' });
    expect(options(element).map((button) => button.textContent?.trim())).toContain('Spain');
  });
});

describe('Copia local', () => {
  it('ignora y borra las copias con el formato anterior, que no traen países', async () => {
    localStorage.setItem('entrejergas.entries.v1', JSON.stringify({ parcero: { id: 1, expression: 'parcero', meaning: 'vieja' } }));
    TestBed.configureTestingModule({});

    const cache = TestBed.inject(EntryCacheService);

    expect(cache.find('parcero')).toBeNull();
    expect(localStorage.getItem('entrejergas.entries.v1')).toBeNull();
  });
});

describe('Traducción de definiciones', () => {
  it('muestra las definiciones en inglés al cambiar el idioma y vuelve al español', async () => {
    const { fixture, element, search, api } = await renderApp();
    vi.spyOn(api, 'lookup').mockReturnValue(of(foundResponse(parcero)));
    const translate = vi.spyOn(api, 'translate');

    await search.search('parcero');
    await settle(fixture);
    const meaning = () => element.querySelector('.meaning')?.textContent;
    expect(meaning()).toContain('Amigo cercano.');
    expect(translate).not.toHaveBeenCalled();

    (element.querySelector('.lang-toggle') as HTMLButtonElement).click();
    await settle(fixture);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(meaning()).toContain('A close friend');
    expect(element.querySelector('.headword')?.textContent).toContain('parcero');

    (element.querySelector('.lang-toggle') as HTMLButtonElement).click();
    await settle(fixture);
    expect(meaning()).toContain('Amigo cercano.');
  });

  it('conserva el español y avisa si la traducción falla', async () => {
    const { fixture, element, search, api } = await renderApp({ language: 'en' });
    vi.spyOn(api, 'lookup').mockReturnValue(of(foundResponse(parcero)));
    vi.spyOn(api, 'translate').mockReturnValue(throwError(() => new Error('502')));

    await search.search('parcero');
    await settle(fixture);

    expect(element.querySelector('.meaning')?.textContent).toContain('Amigo cercano.');
    expect(element.querySelector('.translate-note')?.textContent).toContain('could not translate');
  });
});

describe('Sesión vencida', () => {
  it('cierra la sesión si una ruta protegida responde 401, pero no al fallar el ingreso', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([sessionExpiredInterceptor])), provideHttpClientTesting()]
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);
    session.user.set(ana);

    const login = firstValueFrom(http.post('/api/auth/login', {})).catch(() => undefined);
    backend.expectOne('/api/auth/login').flush({ error: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await login;
    expect(session.user()).toEqual(ana);

    const history = firstValueFrom(http.get('/api/history')).catch(() => undefined);
    backend.expectOne('/api/history').flush({ error: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await history;
    expect(session.user()).toBeNull();
    expect(session.expired()).toBe(true);
  });
});

describe('Sugerencias en el worker', () => {
  it('encuentra candidatos sin importar tildes, mayúsculas ni puntuación', () => {
    expect(findCandidates('¿QUÉ CHIMBA!').map((item) => item.expression)).toContain('qué chimba');
    expect(findCandidates('par').map((item) => item.expression)).toEqual(['parce', 'parcero']);
    expect(findCandidates('pa')).toEqual([]);
    expect(findCandidates('   ')).toEqual([]);
  });

  it('descarta las respuestas que llegan tarde y sobrevive a un fallo del worker', () => {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      sent: Array<{ id: number; text: string }> = [];
      terminated = false;
      constructor() { workers.push(this); }
      postMessage(message: { id: number; text: string }) { this.sent.push(message); }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal('Worker', FakeWorker);
    TestBed.configureTestingModule({});
    const service = TestBed.inject(CandidatesService);

    service.request('par');
    service.request('parce');
    const worker = workers[0];
    expect(worker.sent.map((message) => message.text)).toEqual(['par', 'parce']);

    const fresh = [{ expression: 'parce', region: 'Antioquia' }];
    worker.onmessage?.({ data: { id: worker.sent[1].id, candidates: fresh } });
    worker.onmessage?.({ data: { id: worker.sent[0].id, candidates: [{ expression: 'tarde', region: 'x' }] } });
    expect(service.candidates()).toEqual(fresh);

    worker.onerror?.();
    expect(worker.terminated).toBe(true);
    expect(service.candidates()).toEqual([]);
    service.request('otra');
    expect(workers.length).toBe(1);
  });
});
