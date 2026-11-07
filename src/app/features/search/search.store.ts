import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivityStore } from '../../core/activity.store';
import { ApiService, ExpressionEntry, LookupFailureReason, UnresolvedExpression } from '../../core/api/api.service';
import { isConnectivityError } from '../../core/api/http-errors';
import { SessionStore } from '../../core/session.store';
import { CandidatesService } from './candidates/candidates.service';
import { EntryCacheService } from './entry-cache.service';

export type LookupFailure =
  | { kind: 'reason'; reason: LookupFailureReason }
  | { kind: 'offline' }
  | { kind: 'rejected' };

/** Cada consulta está en un solo estado: el compilador impide mezclar sus datos. */
type SettledLookup =
  | { status: 'found'; entries: ExpressionEntry[]; unresolved: UnresolvedExpression[]; offline: boolean }
  | { status: 'missing'; failure: LookupFailure };

export type Lookup = { id: number; query: string } & ({ status: 'pending' } | SettledLookup);

@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly api = inject(ApiService);
  private readonly activity = inject(ActivityStore);
  private readonly candidates = inject(CandidatesService);
  private readonly cache = inject(EntryCacheService);
  private readonly session = inject(SessionStore);
  private nextId = 0;

  readonly draft = signal('');
  readonly lookups = signal<Lookup[]>([]);
  readonly loading = signal(false);
  readonly focusRequested = signal(false);

  constructor() {
    effect(() => {
      if (this.session.user() === null) untracked(() => this.reset());
    });
  }

  setDraft(value: string): void {
    this.draft.set(value);
    this.candidates.request(value);
  }

  search(expression: string): Promise<void> {
    this.setDraft(expression);
    return this.submit();
  }

  async submit(): Promise<void> {
    const query = this.draft().trim();
    if (!query || this.loading()) return;

    const id = ++this.nextId;
    this.lookups.update((items) => [{ id, query, status: 'pending' }, ...items]);
    this.setDraft('');
    this.loading.set(true);
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: 'smooth' });

    try {
      const result = await firstValueFrom(this.api.lookup(query));
      this.activity.online.set(true);
      for (const entry of result.entries) {
        if (entry.source === 'database') this.cache.save(entry);
      }
      this.settle(id, result.entries.length || result.unresolved.length
        ? { status: 'found', entries: result.entries, unresolved: result.unresolved, offline: false }
        : { status: 'missing', failure: { kind: 'reason', reason: result.reason ?? 'not_found' } });
      void this.activity.refresh();
    } catch (error) {
      this.activity.reportFailure(error);
      const cached = isConnectivityError(error) ? this.cache.find(query) : null;
      this.settle(id, cached
        ? { status: 'found', entries: [cached], unresolved: [], offline: true }
        : { status: 'missing', failure: { kind: isConnectivityError(error) ? 'offline' : 'rejected' } });
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.lookups.set([]);
    this.setDraft('');
  }

  private settle(id: number, state: SettledLookup): void {
    this.lookups.update((items) => items.map((item) =>
      item.id === id ? { id, query: item.query, ...state } : item));
  }
}
