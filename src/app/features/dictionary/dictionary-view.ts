import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivityStore } from '../../core/activity.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { countryName } from '../../shared/country-names';

@Component({
  selector: 'app-dictionary-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dictionary-view.html',
  styleUrl: './dictionary-view.css'
})
export class DictionaryView {
  protected readonly i18n = inject(I18nService);
  protected readonly activity = inject(ActivityStore);

  constructor() {
    void this.activity.loadDashboard();
  }

  protected name(code: string): string {
    return countryName(code, this.i18n.language());
  }
}
