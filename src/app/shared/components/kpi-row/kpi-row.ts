import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface KpiItem {
  label: string;
  value: string | number;
  icon?: string;
}

@Component({
  selector: 'app-kpi-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpi-row">
      @for (item of items(); track item.label) {
        <div class="kpi-row__card">
          <span class="kpi-row__value">{{ item.value }}</span>
          <span class="kpi-row__label">{{ item.label }}</span>
        </div>
      }
    </div>
  `,
  styles: `.kpi-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .kpi-row__card { padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color, #e0e0e0); min-width: 140px; }
    .kpi-row__value { font-size: 1.5rem; font-weight: 700; display: block; }
    .kpi-row__label { font-size: 0.75rem; color: var(--text-secondary, #666); }`,
})
export class KpiRowComponent {
  items = input<KpiItem[]>([]);
}
