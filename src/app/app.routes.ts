import { Routes } from '@angular/router';

/** Cada vista se descarga al visitarla: el primer ingreso carga menos JavaScript. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/search/search-view').then((module) => module.SearchView)
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./features/history/history-view').then((module) => module.HistoryView)
  },
  {
    path: 'diccionario',
    loadComponent: () =>
      import('./features/dictionary/dictionary-view').then((module) => module.DictionaryView)
  },
  {
    path: 'jugar',
    loadComponent: () => import('./features/game/game-view').then((module) => module.GameView)
  },
  { path: '**', redirectTo: '' }
];
