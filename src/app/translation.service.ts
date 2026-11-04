import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, EntryTranslation, ExpressionEntry } from './api.service';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, Promise<EntryTranslation>>();

  translate(entry: ExpressionEntry): Promise<EntryTranslation> {
    const key = entry.id !== null ? `id:${entry.id}` : `temp:${entry.expression}:${entry.meaning}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = firstValueFrom(this.api.translate(entry)).then(({ translation }) => translation);
      pending.catch(() => this.cache.delete(key));
      this.cache.set(key, pending);
    }
    return pending;
  }
}
