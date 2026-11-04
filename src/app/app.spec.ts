import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { ApiService } from './core/api/api.service';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('entrejergas.theme.v1');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{
        provide: ApiService,
        useValue: {
          currentUser: () => of({ user: { id: 1, email: 'ana@example.com', name: 'Ana' } }),
          history: () => of({ items: [] }),
          dashboard: () => of({ expressions: 16, searches: 0, regions: [] }),
          health: () => of({ status: 'ok', service: 'entrejergas-api' }),
          lookup: () => of({ found: false, entry: null, message: 'No encontrada' }),
          translate: () => of({ translation: { meaning: 'A close friend', region: 'Antioquia', context: 'Informal', equivalent: 'buddy', example: 'My parcero helped me.' } })
        }
      }]
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the EntreJergas workspace', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    fixture.componentInstance.authLoading.set(false);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('entrejergas');
    expect(compiled.querySelector('.brand-mark .brand-logo')).toBeTruthy();
    expect(compiled.querySelector('input[name="expression"]')?.getAttribute('aria-label')).toContain('expresión regional');
    (compiled.querySelector('.account-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('.profile-details')?.textContent).toContain('ana@example.com');
  });

  it('should show the login form and allow switching to registration', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.authLoading.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-panel')).toBeTruthy();
    expect(compiled.querySelector('.auth-layout .auth-story h1')?.textContent).toContain('Aquí nadie se queda');
    expect(compiled.querySelector('input[name="email"]')).toBeTruthy();
    expect(compiled.querySelector('.auth-theme-toggle')).toBeTruthy();

    const registerButton = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.auth-switch button'))
      .find((button) => button.textContent?.includes('Regístrate'));
    registerButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('input[name="name"]')).toBeTruthy();
  });

  it('should toggle and persist the selected color theme', () => {
    localStorage.setItem('entrejergas.theme.v1', 'light');
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    fixture.componentInstance.authLoading.set(false);
    fixture.detectChanges();

    const themeButton = fixture.nativeElement.querySelector('.theme-toggle') as HTMLButtonElement;
    expect(fixture.nativeElement.getAttribute('data-theme')).toBe('light');
    themeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('data-theme')).toBe('dark');
    expect(themeButton.getAttribute('aria-label')).toBe('Activar modo claro');
    expect(localStorage.getItem('entrejergas.theme.v1')).toBe('dark');
  });

  it('should toggle and persist the app language', () => {
    localStorage.setItem('entrejergas.language.v1', 'es');
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    fixture.componentInstance.authLoading.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.language()).toBe('es');
    expect(fixture.componentInstance.t('auth.title.login')).toBe('Qué bueno verte.');

    fixture.componentInstance.toggleLanguage();
    fixture.detectChanges();

    expect(fixture.componentInstance.language()).toBe('en');
    expect(fixture.componentInstance.t('auth.title.login')).toBe('Nice to see you again.');
    expect(localStorage.getItem('entrejergas.language.v1')).toBe('en');
  });

  it('shows the newest result first and searches when a suggested word is chosen', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    const lookup = vi.spyOn(TestBed.inject(ApiService), 'lookup');

    app.tryWord('parcero');
    await fixture.whenStable();
    app.tryWord('chichai');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(lookup).toHaveBeenCalledWith('parcero');
    expect(lookup).toHaveBeenCalledWith('chichai');
    expect(app.lookups().map((item) => item.query)).toEqual(['chichai', 'parcero']);
    expect(fixture.nativeElement.querySelector('.missing-body h2')?.textContent).toContain('chichai');
    lookup.mockRestore();
  });

  it('focuses the search box with Ctrl K from any view', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    app.openView('history');
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    expect(app.activeView()).toBe('chat');
    expect(document.activeElement?.getAttribute('name')).toBe('expression');
    fixture.nativeElement.remove();
  });

  it('closes the account menu with Escape', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    app.accountOpen.set(true);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.account-menu')).toBeNull();
  });

  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const parcero = { id: 1, expression: 'parcero', meaning: 'Amigo cercano.', region: 'Antioquia', context: 'Informal', equivalent: 'amigo', example: 'Mi parcero.', pronunciation: null, audioUrl: null, source: 'database' as const };

  it('shows definitions in English when the language changes, and back in Spanish', async () => {
    localStorage.setItem('entrejergas.language.v1', 'es');
    localStorage.removeItem('entrejergas.entries.v1');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const api = TestBed.inject(ApiService);
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: true, entry: parcero }));
    const translate = vi.spyOn(api, 'translate');
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    app.onDraftChange('parcero');
    await app.submit();
    await settle(fixture);

    const meaning = () => fixture.nativeElement.querySelector('.meaning')?.textContent;
    expect(meaning()).toContain('Amigo cercano.');
    expect(translate).not.toHaveBeenCalled();

    app.toggleLanguage();
    await settle(fixture);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(meaning()).toContain('A close friend');
    expect(fixture.nativeElement.querySelector('.headword')?.textContent).toContain('parcero');

    app.toggleLanguage();
    await settle(fixture);
    expect(meaning()).toContain('Amigo cercano.');
    localStorage.setItem('entrejergas.language.v1', 'es');
    localStorage.removeItem('entrejergas.entries.v1');
  });

  it('keeps the Spanish definition and explains it when the translation fails', async () => {
    localStorage.setItem('entrejergas.language.v1', 'en');
    localStorage.removeItem('entrejergas.entries.v1');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const api = TestBed.inject(ApiService);
    vi.spyOn(api, 'lookup').mockReturnValue(of({ found: true, entry: parcero }));
    vi.spyOn(api, 'translate').mockReturnValue(throwError(() => new Error('502')));
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    app.onDraftChange('parcero');
    await app.submit();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.meaning')?.textContent).toContain('Amigo cercano.');
    expect(fixture.nativeElement.querySelector('.translate-note')?.textContent).toContain('could not translate');
    localStorage.setItem('entrejergas.language.v1', 'es');
    localStorage.removeItem('entrejergas.entries.v1');
  });

  it('labels AI answers and does not cache them as dictionary entries', async () => {
    localStorage.setItem('entrejergas.language.v1', 'es');
    localStorage.removeItem('entrejergas.entries.v1');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const lookup = vi.spyOn(TestBed.inject(ApiService), 'lookup').mockReturnValue(of({
      found: true,
      entry: {
        id: null,
        expression: 'palabra nueva',
        meaning: 'Significado generado.',
        region: 'Por confirmar',
        context: 'Uso regional por confirmar.',
        equivalent: 'expresión similar',
        example: 'Un ejemplo de uso.',
        pronunciation: null,
        audioUrl: null,
        source: 'ai'
      }
    }));
    app.currentUser.set({ id: 1, email: 'ana@example.com', name: 'Ana' });
    app.authLoading.set(false);
    app.onDraftChange('palabra nueva');

    await app.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.result-eyebrow')?.textContent).toContain('Generado con IA');
    expect(localStorage.getItem('entrejergas.entries.v1')).toBeNull();

    lookup.mockReturnValue(of({
      found: true,
      entry: {
        id: 24,
        expression: 'otra expresión',
        meaning: 'Significado generado.',
        region: 'Por confirmar',
        context: 'Uso regional por confirmar.',
        equivalent: 'expresión similar',
        example: 'Un ejemplo de uso.',
        pronunciation: null,
        audioUrl: null,
        source: 'ai'
      }
    }));
    app.onDraftChange('“otra expresión”');
    await app.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.result-eyebrow')[0]?.textContent)
      .toContain('agregado al diccionario');

    lookup.mockReturnValue(of({
      found: false,
      entry: null,
      message: 'Gemini no pudo responder (error 503). La expresión no se agregó; inténtalo de nuevo más tarde.'
    }));
    app.onDraftChange('"cachon"');
    await app.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.missing-body p')?.textContent)
      .toContain('error 503');
    expect(fixture.nativeElement.querySelector('.missing-body p')?.textContent)
      .toContain('no se agregó');
    lookup.mockRestore();
  });
});
