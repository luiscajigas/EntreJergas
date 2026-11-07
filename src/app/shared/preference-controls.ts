import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { ThemeService } from '../core/theme.service';
import { Icon } from './icon';

@Component({
  selector: 'app-preference-controls',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="icon-btn lang-toggle"
      type="button"
      (click)="i18n.toggle()"
      [attr.aria-label]="i18n.t('language.toggle.aria')"
      [title]="i18n.t('language.toggle.aria')"
    >
      {{ i18n.language() === 'es' ? 'EN' : 'ES' }}
    </button>
    <button
      class="icon-btn theme-toggle"
      type="button"
      (click)="themes.toggle()"
      [attr.aria-pressed]="isDark()"
      [attr.aria-label]="themeLabel()"
      [title]="themeLabel()"
    >
      <app-icon [name]="isDark() ? 'sun' : 'moon'" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .icon-btn {
      display: grid;
      min-width: 44px;
      height: 44px;
      place-items: center;
      padding: 0 10px;
      border: 0;
      border-radius: 12px;
      background: none;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: background 120ms ease;
    }
    .icon-btn:hover {
      background: color-mix(in srgb, currentColor 14%, transparent);
    }
    .icon-btn:focus-visible {
      outline-color: currentColor;
    }
  `
})
export class PreferenceControls {
  protected readonly i18n = inject(I18nService);
  protected readonly themes = inject(ThemeService);
  protected readonly isDark = computed(() => this.themes.theme() === 'dark');
  protected readonly themeLabel = computed(() =>
    this.i18n.t(this.isDark() ? 'theme.toggle.light' : 'theme.toggle.dark')
  );
}
