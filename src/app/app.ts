import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from './core/i18n/i18n.service';
import { SessionStore } from './core/session.store';
import { ThemeService } from './core/theme.service';
import { AuthPage } from './features/auth/auth-page';
import { Shell } from './layout/shell';
import { Logo } from './shared/logo';

@Component({
  selector: 'app-root',
  imports: [AuthPage, Logo, Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.restoring()) {
      <main class="auth-loading" aria-live="polite">
        <app-logo [size]="96" />
        <span>{{ i18n.t('auth.loading') }}</span>
      </main>
    } @else if (session.user()) {
      <app-shell />
    } @else {
      <app-auth-page />
    }
  `,
  styles: `
    .auth-loading { display: grid; min-height: 100vh; min-height: 100dvh; place-content: center; justify-items: center; gap: 14px; padding: 24px; background: var(--band); color: var(--on-band); font-size: 17px; }
  `
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);

  constructor() {
    inject(ThemeService);
    void this.session.restore();
  }
}
