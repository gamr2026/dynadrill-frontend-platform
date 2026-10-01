import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillTextareaComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';

export interface DeriveToPumpingDialogData {
  subOrder: SubOrder;
}

/** El Jefe deriva una sub-orden Operativo a Pumping — sale del flujo de Mantenimiento a partir de acá. */
@Component({
  selector: 'app-derive-to-pumping-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derive-to-pumping-dialog.html',
  styleUrl: './derive-to-pumping-dialog.scss',
})
export class DeriveToPumpingDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<DeriveToPumpingDialog, boolean>);
  protected readonly data = inject<DeriveToPumpingDialogData>(NZ_MODAL_DATA);

  protected readonly note = signal('');
  protected readonly submitting = signal(false);

  protected readonly canConfirm = computed(() => this.note().trim().length > 0);

  confirm(): void {
    if (!this.canConfirm() || this.submitting()) return;
    this.submitting.set(true);
    this.ordersService.deriveToOperations(this.data.subOrder.id, this.note().trim()).subscribe({
      next: () => {
        this.notify.success('Derivado a Pumping', `${this.data.subOrder.code} salió del flujo de Mantenimiento.`);
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo derivar la sub-orden.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
