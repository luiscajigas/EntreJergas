import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActivityStore } from '../core/activity.store';
import { I18nService } from '../core/i18n/i18n.service';
import { SessionStore } from '../core/session.store';
import { SearchStore } from '../features/search/search.store';
import { Brand } from '../shared/brand';
import { Icon } from '../shared/icon';
import { PreferenceControls } from '../shared/preference-controls';

@Component({
  selector: 'app-shell',
  imports: [Brand, Icon, PreferenceControls, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown)': 'onDocumentKeydown($event)'
  }
})
export class Shell {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionStore);
  protected readonly activity = inject(ActivityStore);
  protected readonly search = inject(SearchStore);
  private readonly router = inject(Router);

  protected readonly accountOpen = signal(false);
  protected readonly initial = computed(() => this.session.user()?.name.charAt(0).toUpperCase() ?? '');

  protected onDocumentClick(event: Event): void {
    if (!(event.target as Element).closest?.('.account')) this.accountOpen.set(false);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.accountOpen.set(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.search.focusRequested.set(true);
      void this.router.navigateByUrl('/');
    }
  }
}
