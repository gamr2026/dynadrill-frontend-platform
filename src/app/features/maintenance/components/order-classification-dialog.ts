import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders, MaintenanceType } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';

export interface OrderClassificationDialogData {
  unitReport: UnitReport;
  /** Si viene, el diálogo abre en modo edición de una orden ya clasificada (salta el paso Sí/No). */
  existingOrder?: MaintenanceOrderWithSubOrders;
}

const ALL_TYPES: MaintenanceType[] = ['Mecánico', 'Instrumental', 'Operativo'];

/**
 * MAN-001-A — Revisión y Clasificación. El Jefe de Mantenimiento decide si
 * el reporte requiere mantenimiento y, de ser así, qué tipo(s) — multi-select
 * confirmado, genera una sub-orden por cada tipo elegido.
 *
 * También sirve para EDITAR una orden ya clasificada (existingOrder): el
 * Jefe puede haberse equivocado de tipo y necesita corregirlo sin perder
 * el trabajo ya hecho en sub-órdenes Cerradas (ver mock: esas se conservan
 * aunque el tipo se destilde).
 */
@Component({
  selector: 'app-order-classification-dialog',
  imports: [CommonModule, DynadrillTextComponent, DynadrillCheckboxComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-classification-dialog.html',
  styleUrl: './order-classification-dialog.scss',
})
export class OrderClassificationDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<OrderClassificationDialog, boolean>);
  protected readonly data = inject<OrderClassificationDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = !!this.data.existingOrder;

  protected readonly requiresMaintenance = signal<boolean | null>(this.isEditMode ? true : null);
  protected readonly selectedTypes = signal<MaintenanceType[]>(this.data.existingOrder?.subOrders.map(s => s.type) ?? []);
  protected readonly dismissReason = signal('');
  protected readonly submitting = signal(false);

  protected readonly allTypes = ALL_TYPES;
  protected readonly canDismiss = computed(() => this.dismissReason().trim().length > 0);

  private readonly originalTypes = new Set(this.data.existingOrder?.subOrders.map(s => s.type) ?? []);
  /** En modo edición, no tiene sentido habilitar "Guardar cambios" si no se cambió nada. */
  protected readonly hasChanges = computed(() => {
    const current = this.selectedTypes();
    return current.length !== this.originalTypes.size || current.some(t => !this.originalTypes.has(t));
  });
  protected readonly canConfirm = computed(() => this.selectedTypes().length > 0 && (!this.isEditMode || this.hasChanges()));

  /** Tipos cuya sub-orden ya está Cerrada — destildarlos no la elimina, solo lo avisamos. */
  protected readonly lockedTypes = computed(
    () => new Set((this.data.existingOrder?.subOrders ?? []).filter(s => s.status === 'Cerrado').map(s => s.type)),
  );

  toggleType(type: MaintenanceType, checked: boolean): void {
    this.selectedTypes.update(types => (checked ? [...types, type] : types.filter(t => t !== type)));
  }

  isChecked(type: MaintenanceType): boolean {
    return this.selectedTypes().includes(type);
  }

  chooseNo(): void {
    this.requiresMaintenance.set(false);
  }

  chooseYes(): void {
    this.requiresMaintenance.set(true);
  }

  confirmDismiss(): void {
    if (!this.canDismiss() || this.submitting()) return;
    this.submitting.set(true);
    this.unitReportsService.dismiss(this.data.unitReport.id, this.dismissReason().trim()).subscribe({
      next: () => {
        this.notify.success('Reporte descartado', 'Queda registrado como "No requiere mantenimiento", con el motivo indicado.');
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo descartar el reporte.');
      },
    });
  }

  confirm(): void {
    if (!this.canConfirm() || this.submitting()) return;
    this.submitting.set(true);

    const request$ = this.isEditMode
      ? this.ordersService.updateClassification(this.data.existingOrder!.id, this.selectedTypes())
      : this.ordersService.classify({
          unitReportId: this.data.unitReport.id,
          unidad: this.data.unitReport.unidad,
          origin: 'MAN-001',
          types: this.selectedTypes(),
        });

    request$.subscribe({
      next: order => {
        this.notify.success(
          this.isEditMode ? 'Clasificación actualizada' : 'Orden clasificada',
          `${order.code} — ${order.subOrders.length} sub-orden(es).`,
        );
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar la clasificación.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
