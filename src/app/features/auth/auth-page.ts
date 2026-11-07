import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorCode, httpStatus } from '../../core/api/http-errors';
import { TranslationKey } from '../../core/i18n/i18n';
import { I18nService } from '../../core/i18n/i18n.service';
import { SessionStore } from '../../core/session.store';
import { Brand } from '../../shared/brand';
import { Icon } from '../../shared/icon';
import { PreferenceControls } from '../../shared/preference-controls';

/** Cuenta pública para evaluar la aplicación. La misma se crea en el backend al arrancar. */
const demoAccount = { email: 'test@gmail.com', password: '12345677' };

function errorKey(error: unknown): TranslationKey {
  if (apiErrorCode(error) === 'rate_limited') return 'auth.error.rateLimited';
  switch (httpStatus(error)) {
    case 400:
      return 'auth.error.invalid';
    case 401:
      return 'auth.error.credentials';
    case 409:
      return 'auth.error.exists';
    default:
      return 'auth.error.network';
  }
}

@Component({
  selector: 'app-auth-page',
  imports: [Brand, FormsModule, Icon, PreferenceControls],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css'
})
export class AuthPage {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly submitting = signal(false);
  protected readonly errorKey = signal<TranslationKey | null>(null);

  protected name = '';
  protected email = '';
  protected password = '';

  protected readonly demoAccount = demoAccount;

  protected useDemoAccount(): void {
    this.mode.set('login');
    this.email = demoAccount.email;
    this.password = demoAccount.password;
    void this.submit();
  }

  protected toggleMode(): void {
    this.mode.update((mode) => (mode === 'login' ? 'register' : 'login'));
    this.errorKey.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;

    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      if (this.mode() === 'register')
        await this.session.register(this.name, this.email, this.password);
      else await this.session.login(this.email, this.password);
    } catch (error) {
      this.errorKey.set(errorKey(error));
    } finally {
      this.password = '';
      this.submitting.set(false);
    }
  }
}
