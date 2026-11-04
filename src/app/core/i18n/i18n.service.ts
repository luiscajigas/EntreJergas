import { Injectable, signal } from '@angular/core';
import { AppLanguage, TranslationKey, translations } from './i18n';

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

  t(key: TranslationKey): string {
    return translations[this.language()][key];
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
