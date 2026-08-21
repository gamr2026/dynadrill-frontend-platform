import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders, UnitFinalState } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { AuthService } from '../../../core/services/auth.service';

export interface ReturnToOperationDialogData {
  order: MaintenanceOrderWithSubOrders;
}

/**
 * Fin Correctivo — Retorno a Operación. Solo llega acá una orden ya
 * Aceptada (todas sus sub-órdenes Cerradas) — cierra el ciclo correctivo
 * devolviendo la unidad a Operaciones/Pumping con su estado final.
 */
@Component({
  selector: 'app-return-to-operation-dialog',
  imports: [CommonModule, DynadrillTextComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './return-to-operation-dialog.html',
  styleUrl: './return-to-operation-dialog.scss',
})
export class ReturnToOperationDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<ReturnToOperationDialog, boolean>);
  protected readonly data = inject<ReturnToOperationDialogData>(NZ_MODAL_DATA);

  protected readonly estadoFinal = signal<UnitFinalState | null>(null);
  protected readonly observaciones = signal('');
  /** Precargado con el Jefe logueado — casi siempre es quien hace la entrega, pero sigue siendo editable. */
  protected readonly responsable = signal(this.auth.currentUser()?.name ?? '');
  protected readonly submitting = signal(false);

  protected readonly canConfirm = computed(() => !!this.estadoFinal() && this.responsable().trim().length > 0);

  chooseEstado(estado: UnitFinalState): void {
    this.estadoFinal.set(estado);
  }

  confirm(): void {
    if (!this.canConfirm() || this.submitting()) return;
    this.submitting.set(true);
    this.ordersService
      .closeOrder(this.data.order.id, {
        estadoFinal: this.estadoFinal()!,
        observaciones: this.observaciones().trim(),
        responsable: this.responsable().trim(),
      })
      .subscribe({
        next: () => {
          this.notify.success('Unidad entregada a Operaciones', `${this.data.order.code} — ${this.data.order.unidad} quedó ${this.estadoFinal()}.`);
          this.modalRef.close(true);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar el retorno a Operaciones.');
        },
      });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
