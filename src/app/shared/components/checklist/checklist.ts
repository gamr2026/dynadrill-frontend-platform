import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

@Component({
  selector: 'app-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="checklist" role="list">
      @for (item of items(); track item.id) {
        <li class="checklist__item">
          <label>
            <input type="checkbox" [checked]="item.checked" (change)="toggled.emit(item.id)" />
            {{ item.label }}
          </label>
        </li>
      }
    </ul>
  `,
  styles: `.checklist { list-style: none; padding: 0; } .checklist__item { padding: 0.5rem 0; }`,
})
export class ChecklistComponent {
  items = input<ChecklistItem[]>([]);
  toggled = output<string>();
}
