import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders, MaintenanceType } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { ClassifyTypeAssignment, MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { RolesService, UsersService } from '../../users/services/users.service';
import { AuthService } from '../../../core/services/auth.service';

export interface OrderClassificationDialogData {
  unitReport: UnitReport;
  /** Si viene, el diálogo abre en modo edición de una orden ya clasificada (salta el paso Sí/No). */
  existingOrder?: MaintenanceOrderWithSubOrders;
}

const ALL_TYPES: MaintenanceType[] = ['Mecánico', 'Instrumental', 'Operativo'];
const OPERATOR_ROLE_NAME = 'Operador de Mantenimiento';

/**
 * MAN-001-A — Revisión y Clasificación. El Jefe de Mantenimiento decide si
 * el reporte requiere mantenimiento y, de ser así, qué tipo(s) — multi-select
 * confirmado, genera una sub-orden por cada tipo elegido. La asignación de
 * operador (Mecánico/Instrumental) y el estado inicial de Operativo viven en
 * este mismo paso — antes eran una acción aparte desde el panel, lo que
 * obligaba a un segundo viaje por cada sub-orden.
 *
 * También sirve para EDITAR una orden ya clasificada (existingOrder): el
 * Jefe puede haberse equivocado de tipo/operador y necesita corregirlo sin
 * perder el trabajo ya hecho en sub-órdenes Cerradas (ver mock: esas se
 * conservan intactas aunque el tipo se destilde).
 */
@Component({
  selector: 'app-order-classification-dialog',
  imports: [
    CommonModule,
    DynadrillTextComponent,
    DynadrillCheckboxComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-classification-dialog.html',
  styleUrl: './order-classification-dialog.scss',
})
export class OrderClassificationDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<OrderClassificationDialog, boolean>);
  protected readonly data = inject<OrderClassificationDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = !!this.data.existingOrder;

  protected readonly requiresMaintenance = signal<boolean | null>(this.isEditMode ? true : null);
  protected readonly selectedTypes = signal<MaintenanceType[]>(this.data.existingOrder?.subOrders.map(s => s.type) ?? []);
  protected readonly dismissReason = signal('');
  protected readonly submitting = signal(false);
  protected readonly loadingOperators = signal(true);

  protected readonly allTypes = ALL_TYPES;
  protected readonly canDismiss = computed(() => this.dismissReason().trim().length > 0);

  private readonly operatorNames = new Map<number, string>();
  protected readonly mecanicoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly instrumentalOptions = signal<DynadrillSelectOption[]>([]);

  private readonly existingSubOrder = (type: MaintenanceType) => this.data.existingOrder?.subOrders.find(s => s.type === type);
  private readonly originalMecanicoOperatorId = this.existingSubOrder('Mecánico')?.assignedUserId ?? null;
  private readonly originalInstrumentalOperatorId = this.existingSubOrder('Instrumental')?.assignedUserId ?? null;
  private readonly originalOperativoAttended = this.existingSubOrder('Operativo')
    ? this.existingSubOrder('Operativo')!.status === 'Derivado a Pumping'
    : true;

  protected readonly mecanicoOperatorId = signal<number | null>(this.originalMecanicoOperatorId);
  protected readonly instrumentalOperatorId = signal<number | null>(this.originalInstrumentalOperatorId);
  /** true = Atendido (default, no bloquea el cierre) — false = Pendiente, queda para derivar después desde el panel. */
  protected readonly operativoAttended = signal<boolean>(this.originalOperativoAttended);

  private readonly originalTypes = new Set(this.data.existingOrder?.subOrders.map(s => s.type) ?? []);
  /** En modo edición, no tiene sentido habilitar "Guardar cambios" si nada cambió (ni tipos ni asignaciones). */
  protected readonly hasChanges = computed(() => {
    const current = this.selectedTypes();
    const typesChanged = current.length !== this.originalTypes.size || current.some(t => !this.originalTypes.has(t));
    const mecanicoChanged = this.isChecked('Mecánico') && this.mecanicoOperatorId() !== this.originalMecanicoOperatorId;
    const instrumentalChanged = this.isChecked('Instrumental') && this.instrumentalOperatorId() !== this.originalInstrumentalOperatorId;
    const operativoChanged = this.isChecked('Operativo') && this.operativoAttended() !== this.originalOperativoAttended;
    return typesChanged || mecanicoChanged || instrumentalChanged || operativoChanged;
  });

  protected readonly canConfirm = computed(() => {
    if (this.selectedTypes().length === 0) return false;
    if (this.isEditMode && !this.hasChanges()) return false;
    if (this.isChecked('Mecánico') && !this.lockedTypes().has('Mecánico') && this.mecanicoOperatorId() == null) return false;
    if (this.isChecked('Instrumental') && !this.lockedTypes().has('Instrumental') && this.instrumentalOperatorId() == null) return false;
    return true;
  });

  /** Tipos cuya sub-orden ya está Cerrada — destildarlos no la elimina, solo lo avisamos, y no se reasigna operador. */
  protected readonly lockedTypes = computed(
    () => new Set((this.data.existingOrder?.subOrders ?? []).filter(s => s.status === 'Cerrado').map(s => s.type)),
  );

  constructor() {
    this.rolesService.list().subscribe(roles => {
      const operatorRole = roles.find(r => r.name === OPERATOR_ROLE_NAME);
      this.usersService.list().subscribe(users => {
        const active = users.filter(u => u.status && u.roleId === operatorRole?.id);
        active.forEach(u => this.operatorNames.set(u.id, u.name));
        this.mecanicoOptions.set(active.filter(u => u.specialty === 'Mecánico').map(u => ({ label: u.name, value: u.id })));
        this.instrumentalOptions.set(active.filter(u => u.specialty === 'Instrumental').map(u => ({ label: u.name, value: u.id })));
        this.loadingOperators.set(false);
      });
    });
  }

  toggleType(type: MaintenanceType, checked: boolean): void {
    this.selectedTypes.update(types => (checked ? [...types, type] : types.filter(t => t !== type)));
  }

  isChecked(type: MaintenanceType): boolean {
    return this.selectedTypes().includes(type);
  }

  selectMecanicoOperator(value: unknown): void {
    this.mecanicoOperatorId.set(typeof value === 'number' ? value : null);
  }

  selectInstrumentalOperator(value: unknown): void {
    this.instrumentalOperatorId.set(typeof value === 'number' ? value : null);
  }

  setOperativoAttended(attended: boolean): void {
    this.operativoAttended.set(attended);
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

    const assignedByName = this.auth.currentUser()?.name ?? '';
    const assignments: ClassifyTypeAssignment[] = this.selectedTypes().map(type => {
      if (type === 'Mecánico') {
        const userId = this.mecanicoOperatorId() ?? undefined;
        return { type, userId, userName: userId != null ? this.operatorNames.get(userId) : undefined };
      }
      if (type === 'Instrumental') {
        const userId = this.instrumentalOperatorId() ?? undefined;
        return { type, userId, userName: userId != null ? this.operatorNames.get(userId) : undefined };
      }
      return { type, operativoAttended: this.operativoAttended() };
    });

    const request$ = this.isEditMode
      ? this.ordersService.updateClassification(this.data.existingOrder!.id, assignments, assignedByName)
      : this.ordersService.classify({
          unitReportId: this.data.unitReport.id,
          unidad: this.data.unitReport.unidad,
          origin: 'MAN-001',
          assignments,
          assignedByName,
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
