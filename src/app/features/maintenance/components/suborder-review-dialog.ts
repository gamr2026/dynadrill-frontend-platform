import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillApprovalActionsComponent,
  DynadrillApprovalDecision,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
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
  imports: [
    CommonModule,
    DynadrillTextComponent,
    DynadrillApprovalActionsComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
    NovedadReadonlyComponent,
  ],
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
  protected readonly correctionNote = signal('');

  protected readonly showCorrectionForm = computed(() => this.decision() === 'rejected' && !this.submitting());
  protected readonly canConfirmRejection = computed(() => this.correctionNote().trim().length > 0);

  /**
   * El operador asignado (para Operativo: operador@dynadrill.com, derivado
   * por Jefe de Mantenimiento) todavía no envió el diagnóstico/actividades
   * ni lo mandó a revisión — antes se podía Aprobar igual, sin ningún
   * aviso, cerrando una sub-orden en la que nadie trabajó todavía (bug
   * reportado). Solo "En Revisión de Cierre" significa que el operador ya
   * terminó y la mandó a revisar — antes de eso no hay nada que aprobar.
   */
  protected readonly puedeRevisar = computed(() => this.data.subOrder.status === 'En Revisión de Cierre');

  decide(decision: DynadrillApprovalDecision): void {
    if (this.submitting() || !decision || !this.puedeRevisar()) return;
    this.decision.set(decision);
    // El rechazo necesita el motivo antes de enviarse — se confirma aparte con confirmRejection().
    if (decision === 'rejected') return;
    this.submit(decision);
  }

  confirmRejection(): void {
    if (!this.canConfirmRejection() || this.submitting()) return;
    this.submit('rejected', this.correctionNote().trim());
  }

  private submit(decision: 'approved' | 'rejected', correctionNote?: string): void {
    this.submitting.set(true);
    this.ordersService.reviewSubOrder(this.data.subOrder.id, decision, correctionNote).subscribe({
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
