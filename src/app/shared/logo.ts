import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img
    class="brand-logo"
    src="logo.svg"
    alt=""
    [attr.width]="size()"
    [attr.height]="size()"
  />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    img {
      display: block;
    }
  `
})
export class Logo {
  readonly size = input(46);
}
