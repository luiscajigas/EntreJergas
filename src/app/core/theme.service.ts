import { Injectable, effect, signal } from '@angular/core';

export type ColorTheme = 'light' | 'dark';

const storageKey = 'entrejergas.theme.v1';
const themeColors: Record<ColorTheme, string> = { light: '#1c2fa8', dark: '#18227a' };

function readThemePreference(): ColorTheme {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // El almacenamiento puede estar deshabilitado por el navegador.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ColorTheme>(readThemePreference());

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
    });
  }

  toggle(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // El tema sigue funcionando aunque no se pueda guardar.
    }
  }
}
