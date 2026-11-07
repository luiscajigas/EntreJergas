import { Injectable } from '@angular/core';
import { ExpressionEntry } from '../../core/api/api.service';
import { normalizeExpression } from '../../shared/normalize-expression';

// La versión cambia con la forma de los datos: una copia de la v1 no trae países y rompería la ficha.
const storageKey = 'entrejergas.entries.v2';
const legacyStorageKey = 'entrejergas.entries.v1';

/** Copia local de lo ya consultado, para seguir mostrándolo si se cae la conexión. */
@Injectable({ providedIn: 'root' })
export class EntryCacheService {
  constructor() {
    try {
      localStorage.removeItem(legacyStorageKey);
    } catch {
      // El almacenamiento local puede estar deshabilitado por el navegador.
    }
  }

  save(entry: ExpressionEntry): void {
    try {
      const cache = this.readAll();
      cache[normalizeExpression(entry.expression)] = entry;
      localStorage.setItem(storageKey, JSON.stringify(cache));
    } catch {
      // El almacenamiento local puede estar deshabilitado por el navegador.
    }
  }

  find(expression: string): ExpressionEntry | null {
    try {
      return this.readAll()[normalizeExpression(expression)] ?? null;
    } catch {
      return null;
    }
  }

  private readAll(): Record<string, ExpressionEntry> {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, ExpressionEntry>;
  }
}
