import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RecordAction, RecordCard, RecordField, RecordStatus } from '../../../../shared/components/record-card/record-card';

/** Un registro de una lista de QHSE en móvil — lo mismo que la tabla de escritorio, como tarjeta (Card/Record en Figma). */
export interface RegistroMovil {
  id: string | number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  status?: RecordStatus | null;
  fields?: RecordField[];
  actions: RecordAction[];
}

/** Lista de tarjetas de registro para las pantallas de QHSE en móvil (Inspecciones, Desechos, EPI, etc.). */
@Component({
  selector: 'app-qhse-registros-movil',
  imports: [RecordCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="registros" [attr.aria-busy]="loading()">
      @for (r of items(); track r.id) {
        <li>
          <app-record-card
            [eyebrow]="r.eyebrow"
            [title]="r.title"
            [subtitle]="r.subtitle ?? ''"
            [status]="r.status ?? null"
            [fields]="r.fields ?? []"
            [actions]="r.actions"
          />
        </li>
      } @empty {
        @if (!loading()) {
          <li class="registros__vacio">{{ vacio() }}</li>
        }
      }
    </ul>
  `,
  styles: `
    .registros {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .registros__vacio {
      padding: 24px 0;
      text-align: center;
      color: var(--text-muted, #5c5870);
    }
  `,
})
export class QhseRegistrosMovil {
  readonly items = input.required<RegistroMovil[]>();
  readonly loading = input(false);
  readonly vacio = input('No hay registros.');
}
