import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, AuthUser } from './api/api.service';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(ApiService);

  readonly user = signal<AuthUser | null>(null);
  readonly restoring = signal(true);
  readonly expired = signal(false);

  async restore(): Promise<void> {
    try {
      this.user.set((await firstValueFrom(this.api.currentUser())).user);
    } catch {
      this.user.set(null);
    } finally {
      this.restoring.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.start((await firstValueFrom(this.api.login(email, password))).user);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    this.start((await firstValueFrom(this.api.register(name, email, password))).user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } catch {
      // La interfaz se cierra aunque el servidor no esté disponible.
    }
    this.user.set(null);
  }

  /** El servidor rechazó la cookie: hay que volver a iniciar sesión. */
  expire(): void {
    if (!this.user()) return;
    this.user.set(null);
    this.expired.set(true);
  }

  private start(user: AuthUser): void {
    this.expired.set(false);
    this.user.set(user);
  }
}
