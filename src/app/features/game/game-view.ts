import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { countryName } from '../../shared/country-names';
import { EntryCard } from '../../shared/entry-card/entry-card';
import { Icon } from '../../shared/icon';
import { GameStore } from './game.store';

@Component({
  selector: 'app-game-view',
  imports: [EntryCard, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-view.html',
  styleUrl: './game-view.css'
})
export class GameView {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameStore);
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');

  constructor() {
    this.game.start();
    // Tras responder, el teclado queda listo para pasar a la siguiente palabra.
    effect(() => this.nextButton()?.nativeElement.focus());
  }

  protected name(code: string): string {
    return countryName(code, this.i18n.language());
  }

  protected names(codes: string[]): string {
    return codes.map((code) => this.name(code)).join(', ');
  }
}
