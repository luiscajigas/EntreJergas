import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityStore } from '../../core/activity.store';
import { HistoryItem } from '../../core/api/api.service';
import { TranslationKey } from '../../core/i18n/i18n';
import { I18nService } from '../../core/i18n/i18n.service';
import { EntryCard } from '../../shared/entry-card/entry-card';
import { Icon } from '../../shared/icon';
import { CandidatesService } from './candidates/candidates.service';
import { DictationService } from './dictation.service';
import { LookupFailure, SearchStore } from './search.store';

const suggestions: readonly { word: string; hint: TranslationKey }[] = [
  { word: 'parcero', hint: 'suggestion.parcero.use' },
  { word: 'boludo', hint: 'suggestion.boludo.use' },
  { word: 'güey', hint: 'suggestion.guey.use' },
  { word: 'dar papaya', hint: 'suggestion.papaya.use' }
];

@Component({
  selector: 'app-search-view',
  imports: [EntryCard, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-view.html',
  styleUrl: './search-view.css'
})
export class SearchView {
  protected readonly i18n = inject(I18nService);
  protected readonly search = inject(SearchStore);
  protected readonly activity = inject(ActivityStore);
  protected readonly candidates = inject(CandidatesService);
  protected readonly dictation = inject(DictationService);

  protected readonly suggestions = suggestions;
  protected readonly title = computed(() => this.i18n.t('welcome.title').split('\n'));
  protected readonly hasResults = computed(() => this.search.lookups().length > 0);
  protected readonly recent = computed(() => this.activity.history().slice(0, 6));
  protected readonly micLabel = computed(() => this.i18n.t(this.dictation.listening() ? 'composer.mic.stop' : 'composer.mic.start'));

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    effect(() => {
      const input = this.searchInput().nativeElement;
      if (!this.search.focusRequested()) return;
      untracked(() => this.search.focusRequested.set(false));
      input.focus();
    });
  }

  protected toggleDictation(): void {
    this.dictation.toggle((transcript) => {
      this.search.setDraft([this.search.draft(), transcript].filter(Boolean).join(' ').trim());
    });
  }

  protected openRecent(item: HistoryItem): void {
    void this.search.search(item.expression);
  }

  protected failureMessage(failure: LookupFailure): string {
    switch (failure.kind) {
      case 'reason': return this.i18n.t(`lookup.reason.${failure.reason}`);
      case 'offline': return this.i18n.t('lookup.offline');
      case 'rejected': return this.i18n.t('lookup.rejected');
    }
  }
}
