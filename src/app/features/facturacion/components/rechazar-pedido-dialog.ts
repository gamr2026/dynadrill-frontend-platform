import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillTextComponent, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Pedido } from '../models/pedido.model';
import { PedidoService } from '../services/pedido.service';
import { AuthService } from '../../../core/services/auth.service';

export interface RechazarPedidoDialogData {
  pedido: Pedido;
}

/** Rechazo del pedido por Facturación hacia Ventas, antes de generar la prefactura — ver `PedidosController.rechazar`. */
@Component({
  selector: 'app-rechazar-pedido-dialog',
  imports: [DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rechazar-pedido-dialog.html',
  styleUrl: './rechazar-pedido-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class RechazarPedidoDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<RechazarPedidoDialog, Pedido | undefined>);
  protected readonly data = inject<RechazarPedidoDialogData>(NZ_MODAL_DATA);

  protected readonly motivo = signal('');
  protected readonly submitting = signal(false);
  protected readonly puedeEnviar = computed(() => this.motivo().trim().length > 0);

  protected rechazar(): void {
    if (!this.puedeEnviar() || this.submitting()) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Facturación';
    this.pedidoService.rechazar(this.data.pedido.id, usuario, this.motivo().trim()).subscribe({
      next: pedido => {
        this.notify.success('Pedido rechazado', `Se devolvió el pedido ${pedido.code} a Ventas para corrección.`);
        this.modalRef.close(pedido);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo rechazar el pedido.');
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
