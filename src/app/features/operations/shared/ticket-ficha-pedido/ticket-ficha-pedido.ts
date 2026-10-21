import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import {
  formatoDia,
  type PedidoDetalle,
} from '../../../facturacion/pedidos-comercial/models/pedido-comercial.model';

/** Lo mínimo del ticket para mostrar la ficha cuando quien consulta no puede leer el pedido de Facturación. */
export interface RespaldoFichaPedido {
  campo: string | null;
  bloque: string | null;
  pozo: string | null;
  taladro: string | null;
  numeroContrato: string | null;
  inicio: string | null;
  fin: string | null;
}

const numero = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cantidad = (v: number): string => v.toLocaleString('en-US', { maximumFractionDigits: 3 });

/**
 * Ficha del pedido de un ticket como la demo: código con sus tipos de servicio, ubicación, fechas, taladro, contrato, responsables y los
 * ítems estimados con su total. Sin permiso para leer el pedido se muestran solo los datos que trae el ticket.
 */
@Component({
  selector: 'app-ticket-ficha-pedido',
  imports: [DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="f">
      <div class="f__cabecera">
        <strong class="f__codigo">Pedido {{ pedidoCodigo() }}</strong>
        <div class="f__tipos">
          @for (s of tipos(); track s) {
            <dynadrill-tag [label]="s" variant="info" [uppercase]="false" />
          }
        </div>
      </div>
      @if (pedido(); as p) {
        <dl class="f__rejilla">
          <div class="f__doble">
            <dt>Ubicación</dt>
            <dd>
              {{ p.ubicacion.campo ?? '—' }} · Bloque {{ p.ubicacion.bloque ?? '—' }} · Pozo
              {{ p.ubicacion.pozo ?? '—' }}
            </dd>
          </div>
          <div>
            <dt>Fecha de inicio</dt>
            <dd>{{ dia(p.fechaInicioServicio) }}</dd>
          </div>
          <div>
            <dt>Fecha de fin</dt>
            <dd>{{ dia(p.fechaFinServicio) }}</dd>
          </div>
          <div>
            <dt>Taladro</dt>
            <dd>{{ p.ubicacion.taladro ?? 'Sin taladro' }}</dd>
          </div>
          <div>
            <dt>N° de contrato</dt>
            <dd>{{ p.numeroContrato ?? '—' }}</dd>
          </div>
          <div>
            <dt>Agente comercial</dt>
            <dd>{{ p.responsables.agenteComercial.nombre ?? '—' }}</dd>
          </div>
          <div>
            <dt>Representante de campo</dt>
            <dd>{{ p.responsables.representanteCampo.nombre ?? '—' }}</dd>
          </div>
        </dl>
        <h3 class="f__subtitulo">Ítems estimados</h3>
        <div class="f__scroll">
          <table class="f__tabla">
            <caption class="sr-only">
              Ítems estimados del pedido
            </caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Unidad</th>
                <th scope="col" class="f__num">Cantidad</th>
                <th scope="col" class="f__num">Valor unitario</th>
                <th scope="col" class="f__num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              @for (i of p.items; track i.id) {
                <tr>
                  <td>
                    <strong>{{ i.codigo }}</strong>
                  </td>
                  <td>{{ i.descripcion }}</td>
                  <td>{{ i.unidad ?? '' }}</td>
                  <td class="f__num">{{ cantidad(i.cantidad) }}</td>
                  <td class="f__num">{{ numero(i.valorUnitario) }}</td>
                  <td class="f__num">{{ numero(i.neto) }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5"><strong>Total estimado</strong></td>
                <td class="f__num">
                  <strong>{{ numero(p.totales.neto) }}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      } @else {
        <dl class="f__rejilla">
          <div class="f__doble">
            <dt>Ubicación</dt>
            <dd>
              {{ respaldo().campo ?? '—' }} · Bloque {{ respaldo().bloque ?? '—' }} · Pozo
              {{ respaldo().pozo ?? '—' }}
            </dd>
          </div>
          <div>
            <dt>Fecha de inicio</dt>
            <dd>{{ dia(respaldo().inicio) }}</dd>
          </div>
          <div>
            <dt>Fecha de fin</dt>
            <dd>{{ dia(respaldo().fin) }}</dd>
          </div>
          <div>
            <dt>Taladro</dt>
            <dd>{{ respaldo().taladro ?? 'Sin taladro' }}</dd>
          </div>
          <div>
            <dt>N° de contrato</dt>
            <dd>{{ respaldo().numeroContrato ?? '—' }}</dd>
          </div>
        </dl>
      }
    </div>
  `,
  styles: `
    .f {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      padding: 1rem;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.625rem;
    }
    .f__cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      padding-bottom: 0.625rem;
      border-bottom: 2px solid var(--dynadrill-purple, #662e9b);
    }
    .f__codigo {
      font-size: 0.875rem;
      font-weight: 600;
    }
    .f__tipos {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .f__rejilla {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 0;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.375rem;
    }
    .f__rejilla > div {
      padding: 0.5rem 0.75rem;
      border-right: 1px solid var(--border, #e5e4ea);
      border-bottom: 1px solid var(--border, #e5e4ea);
    }
    .f__rejilla dt {
      font-size: 0.6875rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--text-muted, #5c5870);
    }
    .f__rejilla dd {
      margin: 0.125rem 0 0;
      font-size: 0.875rem;
    }
    .f__doble {
      grid-column: span 2;
    }
    .f__subtitulo {
      margin: 0.5rem 0 0;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted, #5c5870);
    }
    .f__scroll {
      overflow-x: auto;
    }
    .f__tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .f__tabla th,
    .f__tabla td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-default, #e0e0e0);
    }
    .f__tabla thead th {
      font-weight: 600;
      color: var(--text-secondary, #666);
      background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06));
    }
    .f__tabla tfoot td {
      color: var(--dynadrill-purple, #662e9b);
      border-bottom: 0;
    }
    .f__num {
      text-align: right !important;
      white-space: nowrap;
    }
    @media (max-width: 700px) {
      .f__rejilla {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class TicketFichaPedido {
  readonly pedidoCodigo = input.required<string>();
  readonly tipos = input<string[]>([]);
  readonly pedido = input<PedidoDetalle | null>(null);
  readonly respaldo = input.required<RespaldoFichaPedido>();

  protected readonly dia = formatoDia;
  protected readonly numero = numero;
  protected readonly cantidad = cantidad;
}
