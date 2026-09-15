import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { itemsEstimadosDe, LINEA_SERVICIO_LABELS, type Pedido } from '../models/pedido.model';

export interface VerPedidoDialogData {
  pedido: Pedido;
}

/**
 * Diálogo de solo lectura para ver un Pedido de Ventas — nace en el ticket
 * de Pumping ("el botón junto a Reportar para ver el pedido de Ventas,
 * para que siempre que quieran puedan ver ese dato": Operador/Supervisor no
 * tienen acceso a las rutas de Facturación) y lo reutiliza QHSE en el
 * listado de PTW para dar contexto de qué ítems/químicos están detrás de
 * la actividad del ticket.
 */
@Component({
  selector: 'app-ver-pedido-dialog',
  imports: [DecimalPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ver-pedido-dialog.html',
  styleUrl: './ver-pedido-dialog.scss',
})
export class VerPedidoDialog {
  private readonly modalRef = inject(NzModalRef<VerPedidoDialog>);
  protected readonly data = inject<VerPedidoDialogData>(NZ_MODAL_DATA);
  protected readonly lineaServicioLabels = LINEA_SERVICIO_LABELS;
  protected readonly items = itemsEstimadosDe(this.data.pedido);

  protected cerrar(): void {
    this.modalRef.close();
  }
}
