import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { itemsEstimadosDe, LINEA_SERVICIO_LABELS, type Pedido } from '../../../facturacion/models/pedido.model';

export interface VerPedidoDialogData {
  pedido: Pedido;
}

/**
 * "El botón junto a Reportar para ver el pedido de Ventas, para que siempre
 * que quieran puedan ver ese dato" — de solo lectura, disponible para
 * cualquier rol del ticket (Operador/Supervisor no tienen acceso a las
 * rutas de Facturación, así que se muestra acá en vez de navegar).
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
