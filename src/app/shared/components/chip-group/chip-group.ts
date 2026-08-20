import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ChipOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip-group" role="group">
      @for (chip of options(); track chip.id) {
        <button class="chip-group__chip" [class.chip-group__chip--selected]="chip.id === selected()" (click)="selectedChange.emit(chip.id)">
          {{ chip.label }}
        </button>
      }
    </div>
  `,
  styles: `.chip-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .chip-group__chip { border: 1px solid var(--border-color, #ccc); border-radius: 999px; padding: 0.25rem 0.75rem; background: none; cursor: pointer; }
    .chip-group__chip--selected { background: var(--primary, #1976d2); color: #fff; border-color: var(--primary, #1976d2); }`,
})
export class ChipGroupComponent {
  options = input<ChipOption[]>([]);
  selected = input('');
  selectedChange = output<string>();
}
