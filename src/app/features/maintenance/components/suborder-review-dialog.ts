import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillApprovalActionsComponent, DynadrillApprovalDecision, DynadrillNotificationService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { NovedadReadonlyComponent } from '../../../shared/components/novedad-readonly/novedad-readonly';
import { SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';

export interface SuborderReviewDialogData {
  subOrder: SubOrder;
  /** Lo que reportó el OPERADOR en el Reporte de Unidad — no lo escribe Mantenimiento. */
  novedadOriginal: string;
}

/**
 * MAN-001-C — Revisión de Cierre. Aprobar cierra la sub-orden; Rechazar la
 * regresa a "Corrección Solicitada" para que el mismo operador la corrija
 * (RN-MAN-005 del MD: la corrección vuelve al operador asignado).
 */
@Component({
  selector: 'app-suborder-review-dialog',
  imports: [CommonModule, DynadrillTextComponent, DynadrillApprovalActionsComponent, NovedadReadonlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suborder-review-dialog.html',
  styleUrl: './suborder-review-dialog.scss',
})
export class SuborderReviewDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<SuborderReviewDialog, boolean>);
  protected readonly data = inject<SuborderReviewDialogData>(NZ_MODAL_DATA);

  protected readonly decision = signal<DynadrillApprovalDecision>(null);
  protected readonly submitting = signal(false);

  decide(decision: DynadrillApprovalDecision): void {
    if (this.submitting() || !decision) return;
    this.decision.set(decision);
    this.submitting.set(true);
    this.ordersService.reviewSubOrder(this.data.subOrder.id, decision).subscribe({
      next: () => {
        this.notify.success(
          decision === 'approved' ? 'Sub-orden cerrada' : 'Corrección solicitada',
          decision === 'approved' ? `${this.data.subOrder.code} quedó cerrada/aprobada.` : `${this.data.subOrder.code} regresa al operador.`,
        );
        setTimeout(() => this.modalRef.close(true), 900);
      },
      error: () => {
        this.submitting.set(false);
        this.decision.set(null);
        this.notify.error('Error', 'No se pudo registrar la revisión.');
      },
    });
  }
}
