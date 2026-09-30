import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { ApiService } from './api.service';

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
          health: () => of({ status: 'ok', service: 'entrejergas-api' })
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
    expect(compiled.querySelector('textarea')?.getAttribute('aria-label')).toContain('expresión regional');
    expect(compiled.querySelector('.profile-details')?.textContent).toContain('ana@example.com');
  });

  it('should show the login form and allow switching to registration', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.authLoading.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-panel')).toBeTruthy();
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
});
