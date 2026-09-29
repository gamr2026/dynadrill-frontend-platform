import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillTextComponent, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Pedido } from '../models/pedido.model';
import { PedidoService } from '../services/pedido.service';
import { AuthService } from '../../../core/services/auth.service';

export interface AnularPedidoDialogData {
  pedido: Pedido;
}

/** Cierre definitivo del pedido (ej. el cliente canceló el servicio) — ver `PedidosController.anular`. A diferencia de "Rechazar pedido", no vuelve a Ventas: queda cerrado. */
@Component({
  selector: 'app-anular-pedido-dialog',
  imports: [DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anular-pedido-dialog.html',
  styleUrl: './anular-pedido-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class AnularPedidoDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<AnularPedidoDialog, Pedido | undefined>);
  protected readonly data = inject<AnularPedidoDialogData>(NZ_MODAL_DATA);

  protected readonly motivo = signal('');
  protected readonly submitting = signal(false);
  protected readonly puedeEnviar = computed(() => this.motivo().trim().length > 0);

  protected anular(): void {
    if (!this.puedeEnviar() || this.submitting()) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Facturación';
    this.pedidoService.anular(this.data.pedido.id, usuario, this.motivo().trim()).subscribe({
      next: pedido => {
        this.notify.success('Pedido anulado', `Se anuló el pedido ${pedido.code}.`);
        this.modalRef.close(pedido);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo anular el pedido.');
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
