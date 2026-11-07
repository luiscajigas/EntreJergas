import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ActivityStore } from '../../core/activity.store';
import { ApiService, ExpressionPage } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { EntryCard } from '../../shared/entry-card/entry-card';
import { Icon } from '../../shared/icon';

const pageSize = 20;
const searchDelayMs = 250;

/** Los filtros viven en la URL: se pueden compartir y el botón atrás los respeta. */
@Component({
  selector: 'app-dictionary-view',
  imports: [EntryCard, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dictionary-view.html',
  styleUrl: './dictionary-view.css'
})
export class DictionaryView {
  protected readonly i18n = inject(I18nService);
  protected readonly activity = inject(ActivityStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly query = computed(() => this.params().get('q') ?? '');
  protected readonly country = computed(() => this.params().get('pais'));
  protected readonly page = computed(() =>
    Math.max(1, Math.floor(Number(this.params().get('pagina'))) || 1)
  );

  protected readonly draft = signal(this.query());
  protected readonly result = signal<ExpressionPage | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly expandedId = signal<number | null>(null);
  private readonly reloads = signal(0);

  protected readonly totalPages = computed(() => {
    const result = this.result();
    return result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  });
  protected readonly countLabel = computed(() => {
    const total = this.result()?.total ?? 0;
    return total === 1
      ? this.i18n.t('explore.count.one')
      : this.i18n.format('explore.count.other', { count: total });
  });
  protected readonly hasFilters = computed(() => Boolean(this.query() || this.country()));

  private searchTimer?: ReturnType<typeof setTimeout>;
  private latestRequest = 0;

  constructor() {
    void this.activity.loadDashboard();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));

    effect(() => {
      const filters = { q: this.query(), country: this.country(), page: this.page(), pageSize };
      this.reloads();
      untracked(() => void this.load(filters));
    });
  }

  protected countryNames(codes: string[]): string {
    return codes.map((code) => this.i18n.country(code)).join(' · ');
  }

  protected onSearch(value: string): void {
    this.draft.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.updateFilters({ q: value.trim(), pagina: null }),
      searchDelayMs
    );
  }

  protected selectCountry(code: string | null): void {
    this.updateFilters({ pais: code, pagina: null });
  }

  protected toggleCountry(code: string): void {
    this.selectCountry(this.country() === code ? null : code);
  }

  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.draft.set('');
    this.updateFilters({ q: null, pais: null, pagina: null });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { pagina: page > 1 ? page : null },
      queryParamsHandling: 'merge'
    });
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  protected toggleEntry(id: number | null): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected retry(): void {
    this.reloads.update((count) => count + 1);
  }

  private updateFilters(changes: {
    q?: string | null;
    pais?: string | null;
    pagina?: number | null;
  }): void {
    const queryParams = { ...changes, q: changes.q === '' ? null : changes.q };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private async load(filters: Parameters<ApiService['searchExpressions']>[0]): Promise<void> {
    const request = ++this.latestRequest;
    this.status.set('loading');
    this.expandedId.set(null);
    try {
      const result = await firstValueFrom(this.api.searchExpressions(filters));
      if (request !== this.latestRequest) return;
      this.result.set(result);
      this.status.set('ready');
    } catch (error) {
      if (request !== this.latestRequest) return;
      this.activity.reportFailure(error);
      this.status.set('error');
    }
  }
}
