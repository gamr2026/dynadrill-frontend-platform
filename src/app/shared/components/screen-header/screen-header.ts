import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-screen-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="screen-header">
      <span class="screen-header__eyebrow">{{ eyebrow() }}</span>
      <h1 class="screen-header__title">{{ title() }}</h1>
      <p class="screen-header__subtitle">{{ subtitle() }}</p>
    </header>
  `,
  styles: `
    .screen-header { margin-bottom: 1.5rem; }
    .screen-header__eyebrow { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .screen-header__title { margin: 0.25rem 0; }
    .screen-header__subtitle { color: var(--text-secondary, #666); }
  `,
})
export class ScreenHeaderComponent {
  eyebrow = input('');
  title = input('');
  subtitle = input('');
}
