import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ExpressionEntry } from './api.service';
import { Icon, IconName } from './icon';
import { TranslationKey } from './i18n';
import { I18nService } from './i18n.service';

@Component({
  selector: 'app-entry-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-card.html',
  styleUrl: './entry-card.css'
})
export class EntryCard {
  readonly entry = input.required<ExpressionEntry>();
  readonly offline = input(false);
  readonly i18n = inject(I18nService);

  readonly status = computed<{ icon: IconName; label: TranslationKey; tone: string }>(() => {
    const entry = this.entry();
    if (this.offline()) return { icon: 'bookmark', label: 'message.result.saved', tone: 'tone-neutral' };
    if (entry.source !== 'ai') return { icon: 'check', label: 'message.result.found', tone: 'tone-dictionary' };
    return entry.id !== null
      ? { icon: 'book', label: 'message.result.aiSaved', tone: 'tone-saved' }
      : { icon: 'pen', label: 'message.result.ai', tone: 'tone-ai' };
  });

  play(): void {
    const url = this.entry().audioUrl;
    if (url) void new Audio(url).play();
  }
}
