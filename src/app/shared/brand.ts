import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Logo } from './logo';

@Component({
  selector: 'app-brand',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="brand-mark"><app-logo /></span>
    <span class="brand-name">entre<span>jergas</span></span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    .brand-mark { display: inline-flex; flex: none; }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -.025em; }
    .brand-name span { color: var(--yellow); }
    @media (max-width: 760px) { .brand-name { font-size: 20px; } }
  `
})
export class Brand {}
