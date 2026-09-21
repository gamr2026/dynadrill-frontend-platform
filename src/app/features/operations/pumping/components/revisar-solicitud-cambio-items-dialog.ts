import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { SolicitudCambioItems } from '../models/solicitud-cambio-items.model';

export interface RevisarSolicitudDialogData {
  solicitud: SolicitudCambioItems;
}

export interface RevisarSolicitudDialogResult {
  decision: 'aprobada' | 'rechazada';
  motivoRechazo?: string;
}

/**
 * Bandeja de Aprobaciones del Supervisor — decide sobre una propuesta del
 * Operador. Muestra ítems ORIGINALES (pedido de Ventas) vs. PROPUESTOS lado a
 * lado para que la diferencia salte a la vista antes de aprobar/rechazar.
 */
@Component({
  selector: 'app-revisar-solicitud-cambio-items-dialog',
  imports: [DatePipe, DecimalPipe, DynadrillTextComponent, DynadrillTagComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revisar-solicitud-cambio-items-dialog.html',
  styleUrl: './revisar-solicitud-cambio-items-dialog.scss',
})
export class RevisarSolicitudCambioItemsDialog {
  private readonly modalRef = inject(NzModalRef<RevisarSolicitudCambioItemsDialog, RevisarSolicitudDialogResult | undefined>);
  protected readonly data = inject<RevisarSolicitudDialogData>(NZ_MODAL_DATA);

  protected readonly solicitud = this.data.solicitud;
  /** Ya fue aprobada/rechazada — se abre desde el histórico, en modo solo lectura (sin acciones). */
  protected readonly soloLectura = this.solicitud.estado !== 'pendiente';
  protected readonly mostrarMotivoRechazo = signal(false);
  protected readonly motivoRechazo = signal('');

  protected readonly totalOriginal = computed(() =>
    Math.round(this.solicitud.itemsOriginales.reduce((s, l) => s + l.cantidad * l.valorUnitario, 0) * 100) / 100,
  );
  protected readonly totalPropuesto = computed(() =>
    Math.round(this.solicitud.itemsPropuestos.reduce((s, l) => s + l.cantidad * l.valorUnitario, 0) * 100) / 100,
  );

  protected aprobar(): void {
    this.modalRef.close({ decision: 'aprobada' });
  }

  protected pedirMotivoRechazo(): void {
    this.mostrarMotivoRechazo.set(true);
  }

  protected confirmarRechazo(): void {
    this.modalRef.close({ decision: 'rechazada', motivoRechazo: this.motivoRechazo().trim() || undefined });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
