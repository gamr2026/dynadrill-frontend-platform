import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-critical-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="critical-banner" role="alert">
      <strong>{{ title() }}</strong>
      <span>{{ message() }}</span>
    </div>
  `,
  styles: `.critical-banner { background: var(--error, #d32f2f); color: #fff; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem; }`,
})
export class CriticalBannerComponent {
  title = input('');
  message = input('');
}
