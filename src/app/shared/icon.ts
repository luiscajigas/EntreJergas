import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const circle = (x: number, y: number, r: number) => `M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0-${r * 2} 0`;

const icons = {
  search: [circle(11, 11, 7), 'M20 20l-3.8-3.8'],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
  book: ['M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z', 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3', 'M9 7.5h6'],
  mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  sun: [circle(12, 12, 4), 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z'],
  pin: ['M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z', circle(12, 9.5, 2.5)],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  check: ['M4.5 12.5l5 5 10-11'],
  help: [circle(12, 12, 9), 'M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2.3-2.5 4', 'M12 17.5v.01'],
  pen: ['M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z', 'M14.5 6.5l3 3'],
  bookmark: ['M6 3h12v18l-6-4-6 4z'],
  plus: ['M12 5v14', 'M5 12h14'],
  volume: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  chevron: ['M6 9l6 6 6-6'],
  play: ['M7 4.5v15l12-7.5z'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  back: ['M19 12H5', 'M11 6l-6 6 6 6'],
  offline: ['M3 3l18 18', 'M8.5 16.5a5 5 0 0 1 7 0', 'M12 20v.01', 'M5 12.5a10 10 0 0 1 3.5-2.3', 'M12 7a10 10 0 0 1 7 5.5']
} as const;

export type IconName = keyof typeof icons;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 1.25em; height: 1.25em; flex: none; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly paths = computed(() => icons[this.name()]);
}
