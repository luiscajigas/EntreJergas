import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { EntryTranslation, ExpressionEntry } from '../../core/api/api.service';
import { Icon, IconName } from '../icon';
import { TranslationKey } from '../../core/i18n/i18n';
import { I18nService } from '../../core/i18n/i18n.service';
import { countryName } from '../country-names';
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
    if (entry.classification === 'common') return { icon: 'book', label: 'message.result.common', tone: 'tone-neutral' };
    if (entry.source !== 'ai') return { icon: 'check', label: 'message.result.found', tone: 'tone-dictionary' };
    return entry.id !== null
      ? { icon: 'book', label: 'message.result.aiSaved', tone: 'tone-saved' }
      : { icon: 'pen', label: 'message.result.ai', tone: 'tone-ai' };
  });

  /** Países y región sin repetir: la región se omite si ya nombra uno de los países. */
  readonly place = computed(() => {
    const { countries, region } = this.view();
    const names = countries.map((code) => countryName(code, this.i18n.language()));
    const repeated = names.some((name) => region.toLowerCase().includes(name.toLowerCase()));
    return (repeated ? names : [...names, region]).join(' · ');
  });

  readonly registerKey = computed<TranslationKey | null>(() => {
    const { register } = this.entry();
    return register === 'informal' || register === 'vulgar' ? `register.${register}` : null;
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
