import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, Dashboard, HistoryItem } from './api/api.service';
import { isConnectivityError } from './api/http-errors';
import { SessionStore } from './session.store';

/** Historial y cifras de la cuenta; se cargan al iniciar sesión y se vacían al salir. */
@Injectable({ providedIn: 'root' })
export class ActivityStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

  readonly history = signal<HistoryItem[]>([]);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly online = signal(true);

  constructor() {
    effect(() => {
      const signedIn = this.session.user() !== null;
      untracked(() => {
        if (signedIn) {
          void this.refresh();
        } else {
          this.history.set([]);
          this.dashboard.set(null);
        }
      });
    });
  }

  async refresh(): Promise<void> {
    await Promise.all([this.loadHistory(), this.loadDashboard()]);
  }

  async loadHistory(): Promise<void> {
    try {
      this.history.set((await firstValueFrom(this.api.history())).items);
      this.online.set(true);
    } catch (error) {
      this.reportFailure(error);
    }
  }

  async loadDashboard(): Promise<void> {
    try {
      this.dashboard.set(await firstValueFrom(this.api.dashboard()));
      this.online.set(true);
    } catch (error) {
      this.reportFailure(error);
    }
  }

  reportFailure(error: unknown): void {
    if (isConnectivityError(error)) this.online.set(false);
  }
}
