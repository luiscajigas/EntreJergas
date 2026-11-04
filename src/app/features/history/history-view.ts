import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ActivityStore } from '../../core/activity.store';
import { HistoryItem, HistorySource } from '../../core/api/api.service';
import { TranslationKey } from '../../core/i18n/i18n';
import { I18nService } from '../../core/i18n/i18n.service';
import { Icon, IconName } from '../../shared/icon';
import { SearchStore } from '../search/search.store';

const statuses: Record<HistorySource, { icon: IconName; label: TranslationKey }> = {
  database: { icon: 'check', label: 'history.found' },
  ai: { icon: 'pen', label: 'history.ai' },
  ai_saved: { icon: 'book', label: 'history.aiSaved' },
  not_found: { icon: 'help', label: 'history.notFound' }
};

@Component({
  selector: 'app-history-view',
  imports: [DatePipe, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-view.html',
  styleUrl: './history-view.css'
})
export class HistoryView {
  protected readonly i18n = inject(I18nService);
  protected readonly activity = inject(ActivityStore);
  private readonly search = inject(SearchStore);
  private readonly router = inject(Router);
  protected readonly statuses = statuses;

  constructor() {
    void this.activity.loadHistory();
  }

  protected repeat(item: HistoryItem): void {
    void this.search.search(item.expression);
    void this.router.navigateByUrl('/');
  }
}
