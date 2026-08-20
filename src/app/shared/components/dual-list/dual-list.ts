import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface DualListItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-dual-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dual-list">
      <div class="dual-list__column">
        <h3>Disponibles</h3>
        @for (item of available(); track item.id) {
          <button (click)="added.emit(item.id)">{{ item.label }}</button>
        }
      </div>
      <div class="dual-list__column">
        <h3>Seleccionados</h3>
        @for (item of selected(); track item.id) {
          <button (click)="removed.emit(item.id)">{{ item.label }}</button>
        }
      </div>
    </div>
  `,
  styles: `.dual-list { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .dual-list__column { border: 1px solid var(--border-color, #e0e0e0); border-radius: 8px; padding: 1rem; }`,
})
export class DualListComponent {
  available = input<DualListItem[]>([]);
  selected = input<DualListItem[]>([]);
  added = output<string>();
  removed = output<string>();
}
