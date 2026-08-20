import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillTextareaComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { NovedadReadonlyComponent } from '../../../shared/components/novedad-readonly/novedad-readonly';
import { SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';

export interface SuborderExecutionDialogData {
  subOrder: SubOrder;
  /** Lo que reportó el OPERADOR en el Reporte de Unidad — no lo escribe Mantenimiento. */
  novedadOriginal: string;
}

/**
 * MAN-001-B — Diagnóstico y Ejecución. Al guardar, la sub-orden pasa a "En
 * Revisión de Cierre" (lo resuelve el mock interceptor) y el Jefe de
 * Mantenimiento la revisa desde MAN-001-C.
 */
@Component({
  selector: 'app-suborder-execution-dialog',
  imports: [CommonModule, DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent, NovedadReadonlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suborder-execution-dialog.html',
  styleUrl: './suborder-execution-dialog.scss',
})
export class SuborderExecutionDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<SuborderExecutionDialog, boolean>);
  protected readonly data = inject<SuborderExecutionDialogData>(NZ_MODAL_DATA);

  protected readonly diagnostico = signal(this.data.subOrder.diagnostico ?? '');
  protected readonly actividadesCorrectivas = signal(this.data.subOrder.actividadesCorrectivas ?? '');
  protected readonly submitting = signal(false);
  protected readonly wasRejected = this.data.subOrder.status === 'Corrección Solicitada';
  /** Ya tenía diagnóstico/actividades guardadas — esto es una edición, no el primer envío. */
  protected readonly isEdit = !!(this.data.subOrder.diagnostico || this.data.subOrder.actividadesCorrectivas);
  protected readonly isClosed = this.data.subOrder.status === 'Cerrado';

  submit(): void {
    if (this.submitting()) return;
    if (!this.diagnostico().trim() || !this.actividadesCorrectivas().trim()) {
      this.notify.error('Falta información', 'Completa diagnóstico y actividades correctivas.');
      return;
    }
    this.submitting.set(true);
    this.ordersService
      .updateSubOrder(this.data.subOrder.id, { diagnostico: this.diagnostico(), actividadesCorrectivas: this.actividadesCorrectivas() })
      .subscribe({
        next: () => {
          this.notify.success(
            this.isClosed ? 'Cambios guardados' : 'Enviado a revisión',
            this.isClosed ? `${this.data.subOrder.code} se corrigió (sigue Cerrado).` : `${this.data.subOrder.code} está lista para revisión de cierre.`,
          );
          this.modalRef.close(true);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo guardar la sub-orden.');
        },
      });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
