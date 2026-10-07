import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Lo que muestra la tabla — `ItemEstimado` del Pedido lo cumple tal cual (no se acopla `shared` a Facturación). */
export interface PedidoItemFila {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
}

/**
 * Ítems estimados del Pedido en el detalle de los tickets FCR y Pumping. Las
 * cifras van a la derecha con dígitos de ancho fijo (`.num`, ver styles.scss)
 * para que se lean en columna, como en una orden de trabajo.
 */
@Component({
  selector: 'app-pedido-items',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dyn-pedido-card__table-scroll">
      <table class="dyn-pedido-card__table">
        <caption class="dyn-pedido-card__sr-only">Ítems estimados del Pedido</caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Descripción</th>
            <th scope="col">Unidad</th>
            <th scope="col" class="num">Cantidad</th>
            <th scope="col" class="num">Valor unitario</th>
            <th scope="col" class="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track $index) {
            <tr>
              <td>{{ item.codigo }}</td>
              <td>{{ item.descripcion }}</td>
              <td>{{ item.unidad }}</td>
              <td class="num">{{ item.cantidad | number: '1.0-2' }}</td>
              <td class="num">{{ item.valorUnitario | number: '1.2-2' }}</td>
              <td class="num">{{ item.cantidad * item.valorUnitario | number: '1.2-2' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6">Sin ítems estimados registrados.</td></tr>
          }
        </tbody>
        @if (items().length) {
          <tfoot>
            <tr>
              <th scope="row" colspan="5">Total estimado</th>
              <td class="num">{{ total() | number: '1.2-2' }}</td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class PedidoItems {
  readonly items = input.required<PedidoItemFila[]>();

  protected readonly total = computed(() => this.items().reduce((suma, i) => suma + i.cantidad * i.valorUnitario, 0));
}
