import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="brand-logo" viewBox="0 0 32 32" aria-hidden="true">
      <path fill="var(--yellow)" d="M7 2h18a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H15l-7 5.5V25H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" />
      <circle cx="18.6" cy="7.6" r="2.1" fill="var(--on-yellow)" />
      <path fill="none" stroke="var(--on-yellow)" stroke-linecap="round" stroke-width="3.4" d="M18.6 12.4v6.2a3.3 3.3 0 0 1-5.9 2" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 34px; height: 34px; flex: none; }
    svg { display: block; width: 100%; height: 100%; }
  `
})
export class Logo {}
