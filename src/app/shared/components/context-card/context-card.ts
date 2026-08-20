import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ContextCardItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-context-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="context-card">
      @for (item of items(); track item.label) {
        <div class="context-card__item">
          <span class="context-card__label">{{ item.label }}</span>
          <span class="context-card__value">{{ item.value }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .context-card { display: flex; flex-wrap: wrap; gap: 1rem; padding: 1rem; border: 1px solid var(--border-color, #e0e0e0); border-radius: 8px; }
    .context-card__label { font-size: 0.75rem; color: var(--text-secondary, #666); display: block; }
    .context-card__value { font-weight: 500; }
  `,
})
export class ContextCardComponent {
  items = input<ContextCardItem[]>([]);
}
