import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { Injectable, effect, signal } from '@angular/core';
import { AppLanguage, TranslationKey, translations } from './i18n';

registerLocaleData(localeEs);

const storageKey = 'entrejergas.language.v1';

function readLanguagePreference(): AppLanguage {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // El idioma sigue funcionando aunque no se pueda guardar.
  }
  return 'es';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<AppLanguage>(readLanguagePreference());

  private readonly regionNames: Record<AppLanguage, Intl.DisplayNames> = {
    es: new Intl.DisplayNames(['es'], { type: 'region' }),
    en: new Intl.DisplayNames(['en'], { type: 'region' })
  };

  constructor() {
    effect(() => {
      document.documentElement.lang = this.language();
    });
  }

  t(key: TranslationKey): string {
    return translations[this.language()][key];
  }

  /** Traduce un texto con valores: format('explore.page', { page: 1 }). */
  format(key: TranslationKey, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      this.t(key)
    );
  }

  /** El navegador ya conoce los nombres de los países en cada idioma. */
  country(code: string): string {
    return this.regionNames[this.language()].of(code) ?? code;
  }

  toggle(): void {
    const next = this.language() === 'es' ? 'en' : 'es';
    this.language.set(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // El idioma sigue funcionando aunque no se pueda guardar.
    }
  }
}
