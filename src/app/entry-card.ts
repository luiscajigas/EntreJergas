import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { EntryTranslation, ExpressionEntry } from './api.service';
import { Icon, IconName } from './icon';
import { TranslationKey } from './i18n';
import { I18nService } from './i18n.service';
import { TranslationService } from './translation.service';

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
  private readonly translations = inject(TranslationService);

  private readonly translation = signal<EntryTranslation | null>(null);
  readonly translating = signal(false);
  readonly translateFailed = signal(false);

  readonly view = computed<ExpressionEntry>(() => ({
    ...this.entry(),
    ...(this.i18n.language() === 'en' ? this.translation() : null)
  }));

  readonly status = computed<{ icon: IconName; label: TranslationKey; tone: string }>(() => {
    const entry = this.entry();
    if (this.offline()) return { icon: 'bookmark', label: 'message.result.saved', tone: 'tone-neutral' };
    if (entry.source !== 'ai') return { icon: 'check', label: 'message.result.found', tone: 'tone-dictionary' };
    return entry.id !== null
      ? { icon: 'book', label: 'message.result.aiSaved', tone: 'tone-saved' }
      : { icon: 'pen', label: 'message.result.ai', tone: 'tone-ai' };
  });

  constructor() {
    effect(() => {
      const entry = this.entry();
      if (this.i18n.language() === 'en') untracked(() => void this.loadTranslation(entry));
      else untracked(() => this.translateFailed.set(false));
    });
  }

  private async loadTranslation(entry: ExpressionEntry): Promise<void> {
    if (this.translation()) return;
    this.translating.set(true);
    this.translateFailed.set(false);
    try {
      this.translation.set(await this.translations.translate(entry));
    } catch {
      this.translateFailed.set(true);
    } finally {
      this.translating.set(false);
    }
  }

  play(): void {
    const url = this.entry().audioUrl;
    if (url) void new Audio(url).play();
  }
}
