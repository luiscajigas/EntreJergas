import { AppLanguage } from '../core/i18n/i18n';

/** El navegador ya conoce los nombres de los países en cada idioma. */
export function countryName(code: string, language: AppLanguage): string {
  return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
}
