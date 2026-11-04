import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Candidate, CandidateRequest, CandidateResponse } from './candidate.protocol';

/**
 * Mantiene las sugerencias fuera del hilo principal. Si el navegador no permite
 * workers o el worker falla, la búsqueda sigue funcionando sin sugerencias.
 */
@Injectable({ providedIn: 'root' })
export class CandidatesService {
  readonly candidates = signal<Candidate[]>([]);

  private worker?: Worker;
  private workerFailed = false;
  private latestRequest = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.worker?.terminate());
  }

  request(text: string): void {
    const id = ++this.latestRequest;
    if (!text.trim()) this.candidates.set([]);
    const message: CandidateRequest = { id, text };
    this.ensureWorker()?.postMessage(message);
  }

  private ensureWorker(): Worker | undefined {
    if (this.worker || this.workerFailed || typeof Worker === 'undefined') return this.worker;

    const worker = new Worker(new URL('./regionalism.worker', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<CandidateResponse>) => {
      if (data.id === this.latestRequest) this.candidates.set(data.candidates);
    };
    worker.onerror = () => {
      this.workerFailed = true;
      this.candidates.set([]);
      worker.terminate();
      this.worker = undefined;
    };
    this.worker = worker;
    return worker;
  }
}
