import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import { QhseChip, type QhseChipTone } from '../../qhse/shared/components/qhse-chip';

export interface MntCompactChip {
  text: string;
  tone: QhseChipTone;
}

export interface MntCompactAction {
  icon: string;
  label: string;
  run: () => void;
}

export interface MntCompactItem {
  id: string | number;
  title: string;
  lines: string[];
  chips: MntCompactChip[];
  actions: MntCompactAction[];
}

/**
 * Fila compacta en tarjeta (Figma "M · Preventivo", "M · Inspecciones", "M · Gerenciamiento de Viaje"): título, una o
 * dos líneas de detalle, chips de estado y botones de ícono a la derecha.
 */
@Component({
  selector: 'app-mnt-compact-list',
  imports: [QhseChip, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="lista" [attr.aria-busy]="loading()">
      @for (item of items(); track item.id) {
        <li class="fila">
          <div class="fila__cuerpo">
            <strong class="fila__titulo">{{ item.title }}</strong>
            @for (linea of item.lines; track $index) {
              <span class="fila__linea">{{ linea }}</span>
            }
            @if (item.chips.length) {
              <span class="fila__chips">
                @for (chip of item.chips; track chip.text) {
                  <app-qhse-chip [label]="chip.text" [tone]="chip.tone" />
                }
              </span>
            }
          </div>
          <div class="fila__acciones">
            @for (a of item.actions; track a.label) {
              <dynadrill-icon-button
                [icon]="$any(a.icon)"
                iconSource="dynadrill"
                [tooltip]="a.label"
                tooltipPlacement="top"
                (clicked)="a.run()"
              />
            }
          </div>
        </li>
      } @empty {
        @if (!loading()) {
          <li class="lista__vacio">{{ vacio() }}</li>
        }
      }
    </ul>
  `,
  styles: `
    .lista {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .fila {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      padding: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: var(--radius-lg, 16px);
      box-shadow: 0 1px 2px rgba(19, 21, 41, 0.05);
    }

    .fila__cuerpo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .fila__titulo {
      font-size: 16px;
      font-weight: 500;
      color: var(--dynadrill-navy, #131529);
    }

    .fila__linea {
      font-size: 12px;
      color: var(--text-muted, #5c5870);
    }

    .fila__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .fila__acciones {
      display: flex;
      flex: none;
      align-items: center;
      gap: 2px;
    }

    .lista__vacio {
      padding: 24px 0;
      text-align: center;
      color: var(--text-muted, #5c5870);
    }
  `,
})
export class MntCompactList {
  readonly items = input.required<MntCompactItem[]>();
  readonly loading = input(false);
  readonly vacio = input('No hay registros.');
}
