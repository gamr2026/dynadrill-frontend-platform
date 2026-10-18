import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_SOLICITUD_LABELS,
  ESTADO_SOLICITUD_TONO,
  compararItems,
  etiquetaAplicacion,
  type CambioDeItem,
  type ItemsParaCambio,
  type SolicitudCambioItems,
} from '../../models/cambio-items';
import { mensajeErrorTicket } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketCambioItemsRevisarDialogData {
  solicitud: SolicitudCambioItems;
  /** `pedidoId` del ticket: de ahí se leen los ítems que el pedido tiene hoy. */
  pedidoId: string;
  /** Quien revisa es el Supervisor del ticket (puede aprobar o rechazar). */
  puedeRevisar: boolean;
}

/**
 * El Supervisor decide sobre el cambio de ítems que propuso el Operador. Se muestra lo que cambia respecto a lo que el pedido tiene
 * hoy (ítems nuevos, quitados y cantidades o descuentos distintos) y los ítems propuestos completos. Al aprobar, Comercial aplica
 * el cambio con los precios de su lista; el resultado queda en la solicitud.
 */
@Component({
  selector: 'app-ticket-cambio-items-revisar-dialog',
  imports: [DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    <div class="cr">
      <div class="cr__cabecera">
        <dynadrill-tag [label]="estadoEtiqueta" [variant]="estadoTono" [uppercase]="false" />
        @if (aplicacion(); as a) { <span class="cr__meta">{{ a }}</span> }
      </div>
      <dl class="cr__datos">
        <div><dt>Solicitado por</dt><dd>{{ s.solicitadoPor.nombre }}</dd></div>
        <div><dt>Motivo</dt><dd>{{ s.motivo }}</dd></div>
        @if (s.motivoRechazo) { <div><dt>Motivo del rechazo</dt><dd>{{ s.motivoRechazo }}</dd></div> }
      </dl>

      @if (s.estado === 'pendiente') {
      <h3 class="cr__titulo">Lo que cambia en el pedido</h3>
      @if (cargando()) {
        <dynadrill-text variant="caption">Comparando con los ítems del pedido…</dynadrill-text>
      } @else if (errorComparacion(); as e) {
        <dynadrill-text variant="caption" role="status">{{ e }}</dynadrill-text>
      } @else {
        <ul class="cr__cambios">
          @for (c of cambios(); track $index) {
            <li [class]="'cr__cambio cr__cambio--' + c.tipo">{{ texto(c) }}</li>
          } @empty {
            <li class="cr__meta">Ningún cambio respecto a lo que el pedido tiene hoy.</li>
          }
        </ul>
      }
      }

      <h3 class="cr__titulo">Ítems propuestos</h3>
      <table class="cr__tabla">
        <thead><tr><th scope="col">Ítem</th><th scope="col">Unidad</th><th scope="col">Cantidad</th><th scope="col">Descuento %</th></tr></thead>
        <tbody>
          @for (i of s.items; track i.listaPreciosItemId) {
            <tr><td><strong>{{ i.codigo }}</strong> <span class="cr__meta">{{ i.descripcion }}</span></td><td>{{ i.unidad }}</td><td>{{ i.cantidad }}</td><td>{{ i.descuentoPct ?? '—' }}</td></tr>
          }
        </tbody>
      </table>

      @if (data.puedeRevisar && s.estado === 'pendiente' && rechazando()) {
        <dynadrill-textarea label="Motivo del rechazo (opcional)" [rows]="2" [value]="motivo()" (valueChange)="motivo.set($event)" />
      }
    </div>
    <footer class="cr__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      @if (data.puedeRevisar && s.estado === 'pendiente') {
        @if (rechazando()) {
          <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="rechazando.set(false)">No rechazar</dynadrill-button>
          <dynadrill-button variant="primary" [disabled]="enviando()" (clicked)="rechazar()">Confirmar el rechazo</dynadrill-button>
        } @else {
          <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="rechazando.set(true)">Rechazar</dynadrill-button>
          <dynadrill-button variant="primary" [disabled]="enviando()" (clicked)="aprobar()">{{ enviando() ? 'Enviando…' : 'Aprobar' }}</dynadrill-button>
        }
      }
    </footer>
  `,
  styles: `
    .cr { display: flex; flex-direction: column; gap: 14px; }
    .cr__cabecera { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .cr__datos { display: grid; gap: 6px; margin: 0; font-size: 14px; }
    .cr__datos dt { color: #5c5870; font-size: 12px; }
    .cr__datos dd { margin: 0; }
    .cr__titulo { margin: 0; font-size: 15px; }
    .cr__meta { font-size: 12px; color: #5c5870; }
    .cr__cambios { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
    .cr__cambio--nuevo { color: #1f5c39; }
    .cr__cambio--quitado { color: #8c1d18; }
    .cr__tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .cr__tabla th, .cr__tabla td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ecebf1; }
    .cr__tabla th { font-weight: 600; color: #5c5870; }
    .cr__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketCambioItemsRevisarDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketCambioItemsRevisarDialog, SolicitudCambioItems | undefined>);
  protected readonly data = inject<TicketCambioItemsRevisarDialogData>(NZ_MODAL_DATA);
  protected readonly s = this.data.solicitud;

  protected readonly estadoEtiqueta = ESTADO_SOLICITUD_LABELS[this.s.estado];
  protected readonly estadoTono = ESTADO_SOLICITUD_TONO[this.s.estado];
  protected readonly aplicacion = computed(() => etiquetaAplicacion(this.s));
  protected readonly cargando = signal(true);
  protected readonly errorComparacion = signal<string | null>(null);
  private readonly hoy = signal<ItemsParaCambio['actuales']>([]);
  protected readonly cambios = computed(() => compararItems(this.hoy(), this.s.items));
  protected readonly rechazando = signal(false);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);

  constructor() {
    this.servicio.itemsParaCambio(this.data.pedidoId).subscribe({
      next: r => {
        this.hoy.set(r.actuales);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorComparacion.set('No se pudo comparar con los ítems actuales del pedido; revise la lista propuesta.');
      },
    });
  }

  protected texto(c: CambioDeItem): string {
    const n = `${c.item.codigo} · ${c.item.descripcion}`;
    switch (c.tipo) {
      case 'nuevo':
        return `Se agrega ${n}: ${c.item.cantidad} ${c.item.unidad}`;
      case 'quitado':
        return `Se quita ${n}`;
      case 'cantidad':
        return `${n}: la cantidad pasa de ${c.antes} a ${c.item.cantidad}`;
      case 'descuento':
        return `${n}: el descuento pasa de ${c.antes ?? 'ninguno'} a ${c.item.descuentoPct ?? 'ninguno'}`;
    }
  }

  protected aprobar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.servicio.aprobarCambioItems(this.s.id).subscribe({
      next: r => {
        this.notify.success('Cambio aprobado', 'Se envió a Facturación para aplicarlo al pedido.');
        this.modalRef.close(r);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo aprobar', mensajeErrorTicket(err, 'No se pudo aprobar el cambio. Intente de nuevo.'));
      },
    });
  }

  protected rechazar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.servicio.rechazarCambioItems(this.s.id, this.motivo()).subscribe({
      next: r => {
        this.notify.success('Cambio rechazado');
        this.modalRef.close(r);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo rechazar', mensajeErrorTicket(err, 'No se pudo rechazar el cambio. Intente de nuevo.'));
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(undefined);
  }
}
