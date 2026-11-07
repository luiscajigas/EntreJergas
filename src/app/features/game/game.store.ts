import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivityStore } from '../../core/activity.store';
import { ApiService, ExpressionEntry, GameRound } from '../../core/api/api.service';
import { SessionStore } from '../../core/session.store';

const bestStreakKey = 'entrejergas.game.best.v1';
const recentLimit = 25;

function readBestStreak(): number {
  try {
    return Number(localStorage.getItem(bestStreakKey)) || 0;
  } catch {
    return 0;
  }
}

export type GameState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'question'; round: GameRound; checking: boolean }
  | {
      status: 'answered';
      round: GameRound;
      chosen: string;
      correct: boolean;
      entry: ExpressionEntry;
    };

/** Los puntos viven en la sesión; el servidor es quien decide si una respuesta es correcta. */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly api = inject(ApiService);
  private readonly activity = inject(ActivityStore);
  private readonly session = inject(SessionStore);
  private recent: number[] = [];

  readonly state = signal<GameState>({ status: 'loading' });
  readonly correct = signal(0);
  readonly played = signal(0);
  readonly streak = signal(0);
  readonly bestStreak = signal(readBestStreak());

  constructor() {
    effect(() => {
      if (this.session.user() === null) untracked(() => this.resetScore());
    });
  }

  /** Continúa la ronda en curso si la hay, por ejemplo al volver a esta pestaña. */
  start(): void {
    const { status } = this.state();
    if (status !== 'question' && status !== 'answered') void this.nextRound();
  }

  async nextRound(): Promise<void> {
    this.state.set({ status: 'loading' });
    try {
      const { round } = await firstValueFrom(this.api.gameRound(this.recent));
      if (!round) {
        this.state.set({ status: 'empty' });
        return;
      }
      this.recent = [...this.recent, round.id].slice(-recentLimit);
      this.state.set({ status: 'question', round, checking: false });
    } catch (error) {
      this.activity.reportFailure(error);
      this.state.set({ status: 'error' });
    }
  }

  async answer(country: string): Promise<void> {
    const state = this.state();
    if (state.status !== 'question' || state.checking) return;

    this.state.set({ ...state, checking: true });
    try {
      const { correct, entry } = await firstValueFrom(this.api.gameAnswer(state.round.id, country));
      this.played.update((count) => count + 1);
      if (correct) {
        this.correct.update((count) => count + 1);
        this.streak.update((count) => count + 1);
        this.saveBestStreak();
      } else {
        this.streak.set(0);
      }
      this.state.set({ status: 'answered', round: state.round, chosen: country, correct, entry });
    } catch (error) {
      this.activity.reportFailure(error);
      this.state.set({ status: 'error' });
    }
  }

  private saveBestStreak(): void {
    if (this.streak() <= this.bestStreak()) return;
    this.bestStreak.set(this.streak());
    try {
      localStorage.setItem(bestStreakKey, String(this.streak()));
    } catch {
      // La mejor racha sigue visible aunque no se pueda guardar.
    }
  }

  private resetScore(): void {
    this.correct.set(0);
    this.played.set(0);
    this.streak.set(0);
    this.recent = [];
    this.state.set({ status: 'loading' });
  }
}
