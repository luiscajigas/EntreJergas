import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { ApiService, ExpressionEntry, LookupResponse } from './core/api/api.service';
import { sessionExpiredInterceptor } from './core/api/session-expired.interceptor';
import { SessionStore } from './core/session.store';
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
  source: 'database'
};

function createApi(signedIn: boolean) {
  return {
    currentUser: () => signedIn ? of({ user: ana }) : throwError(() => new HttpErrorResponse({ status: 401 })),
    login: () => of({ user: ana }),
    register: () => of({ user: ana }),
    logout: () => of(undefined),
    history: () => of({ items: [] }),
    dashboard: () => of({ expressions: 16, searches: 0, regions: [] }),
    lookup: (): ReturnType<ApiService['lookup']> => of({ found: false, entry: null, reason: 'not_found' } as LookupResponse),
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
  localStorage.removeItem('entrejergas.entries.v1');

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

    lookup.mockReturnValue(of({ found: true, entry: { ...parcero, id: null, expression: 'palabra nueva', source: 'ai' } }));
    await search.search('palabra nueva');
    await settle(fixture);
    expect(element.querySelector('.result-eyebrow')?.textContent).toContain('Generado con IA');
    expect(localStorage.getItem('entrejergas.entries.v1')).toBeNull();

    lookup.mockReturnValue(of({ found: true, entry: { ...parcero, id: 24, expression: 'otra', source: 'ai' } }));
    await search.search('“otra”');
    await settle(fixture);
    expect(element.querySelector('.result-eyebrow')?.textContent).toContain('agregado al diccionario');
  });

  it('muestra el motivo del fallo en el idioma elegido', async () => {
    const { fixture, element, search, api } = await renderApp({ language: 'en' });
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: false, entry: null, reason: 'provider_unavailable', message: 'Gemini no pudo responder (error 503).' }));

    await search.search('cachon');
    await settle(fixture);

    expect(element.querySelector('.missing-body p')?.textContent).toContain('The AI could not reply');
  });

  it('muestra el mensaje del servidor si no recibe un motivo', async () => {
    const { fixture, element, search, api } = await renderApp();
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: false, entry: null, message: 'Gemini no pudo responder (error 503).' }));

    await search.search('cachon');
    await settle(fixture);

    expect(element.querySelector('.missing-body p')?.textContent).toContain('error 503');
  });

  it('usa la copia local solo si falla la conexión', async () => {
    const { fixture, element, search, api } = await renderApp();
    const lookup = vi.spyOn(api, 'lookup');

    lookup.mockReturnValue(of({ found: true, entry: parcero }));
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

describe('Traducción de definiciones', () => {
  it('muestra las definiciones en inglés al cambiar el idioma y vuelve al español', async () => {
    const { fixture, element, search, api } = await renderApp();
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: true, entry: parcero }));
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
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: true, entry: parcero }));
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
