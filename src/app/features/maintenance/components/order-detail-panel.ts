import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  computeOrderStatus,
  MaintenanceOrderWithSubOrders,
  SubOrder,
  SubOrderStatus,
} from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { DeriveToPumpingDialog, DeriveToPumpingDialogData } from './derive-to-pumping-dialog';
import { ReturnToOperationDialog, ReturnToOperationDialogData } from './return-to-operation-dialog';
import { RolesService } from '../../users/services/users.service';
import { mensajeDeError } from '../../../shared/utils/mensaje-error.util';
import { QhseChip } from '../../qhse/shared/components/qhse-chip';

export interface OrderDetailPanelData {
  unitReport: UnitReport;
  order: MaintenanceOrderWithSubOrders;
}

const STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  Cerrado: 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

const STATUS_ACCENT: Record<
  SubOrderStatus,
  'warning' | 'info' | 'brand' | 'success' | 'error' | 'neutral' | 'none'
> = {
  Pendiente: 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  Cerrado: 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

@Component({
  selector: 'app-order-detail-panel',
  /** Pantalla completa en móvil (Figma "M · Orden · Detalle") — ver styles.scss. */
  host: { class: 'app-drawer-fullscreen-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillSelectComponent,
    DynadrillIconButtonComponent,
    DynadrillTextareaComponent,
    QhseChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-panel.html',
  styleUrl: './order-detail-panel.scss',
})
export class OrderDetailPanel {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawerRef = inject(NzDrawerRef<OrderDetailPanel>);
  private readonly rolesService = inject(RolesService);
  protected readonly data = inject<OrderDetailPanelData>(NZ_DRAWER_DATA);

  protected readonly report = this.data.unitReport;
  protected readonly currentOrder = signal<MaintenanceOrderWithSubOrders>(this.data.order);

  protected readonly orderStatus = computed(() =>
    computeOrderStatus(this.currentOrder(), this.currentOrder().subOrders),
  );
  protected readonly isReadyToReturn = computed(() => this.orderStatus() === 'Aceptado');

  // ── Edición inline de operador por sub-orden ──
  protected readonly editingSubId = signal<string | null>(null);
  protected readonly editingOperatorId = signal<string | null>(null);
  protected readonly reassigning = signal(false);
  protected readonly mecanicoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly instrumentalOptions = signal<DynadrillSelectOption[]>([]);

  // ── Revisión inline de cierre (reemplaza el modal SuborderReviewDialog) ──
  protected readonly rejectingSubId = signal<string | null>(null);
  protected readonly rejectionNote = signal('');
  protected readonly reviewing = signal(false);

  protected readonly statusTone = STATUS_TONE;

  /** Tono del chip del estado general de la orden. */
  protected readonly orderTone = computed<'success' | 'neutral' | 'error' | 'warning'>(() => {
    const status = this.orderStatus();
    return status === 'Aceptado'
      ? 'success'
      : status === 'Cerrado'
        ? 'neutral'
        : status === 'Requiere cambios'
          ? 'error'
          : 'warning';
  });
  protected readonly statusAccent = STATUS_ACCENT;

  constructor() {
    this.rolesService.usuariosPorRol('operador_mantenimiento').subscribe((usuarios) => {
      this.mecanicoOptions.set(
        usuarios
          .filter((u) => u.specialty === 'Mecánico')
          .map((u) => ({ label: u.name, value: u.id })),
      );
      this.instrumentalOptions.set(
        usuarios
          .filter((u) => u.specialty === 'Instrumental')
          .map((u) => ({ label: u.name, value: u.id })),
      );
    });
  }

  private refreshOrder(): void {
    this.ordersService
      .get(this.currentOrder().id)
      .subscribe((updated) => this.currentOrder.set(updated));
  }

  operatorOptionsFor(sub: SubOrder): DynadrillSelectOption[] {
    return sub.type === 'Mecánico' ? this.mecanicoOptions() : this.instrumentalOptions();
  }

  startEditOperator(sub: SubOrder): void {
    this.editingSubId.set(sub.id);
    this.editingOperatorId.set(sub.assignedUserId ?? null);
  }

  onOperatorChange(valor: unknown): void {
    this.editingOperatorId.set(typeof valor === 'string' ? valor : null);
  }

  cancelEditOperator(): void {
    this.editingSubId.set(null);
    this.editingOperatorId.set(null);
  }

  saveOperator(sub: SubOrder): void {
    const newId = this.editingOperatorId();
    if (!newId || this.reassigning()) return;
    if (!this.operatorOptionsFor(sub).some((o) => o.value === newId)) return;
    this.reassigning.set(true);
    this.ordersService.reassignOperator(sub.id, newId).subscribe({
      next: () => {
        this.editingSubId.set(null);
        this.editingOperatorId.set(null);
        this.reassigning.set(false);
        this.refreshOrder();
      },
      error: (e) => {
        this.reassigning.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo reasignar el operador.'));
      },
    });
  }

  isDerivable(sub: SubOrder): boolean {
    return sub.type === 'Operativo' && sub.status === 'Pendiente';
  }

  // Punto 3: excluir "En Revisión de Cierre" — no tiene sentido cambiar operador cuando ya entregó
  canEditOperator(sub: SubOrder): boolean {
    return (
      sub.type !== 'Operativo' &&
      sub.status !== 'Cerrado' &&
      sub.status !== 'Derivado a Pumping' &&
      sub.status !== 'En Revisión de Cierre'
    );
  }

  hasProgress(sub: SubOrder): boolean {
    return !!(
      sub.diagnostico ||
      sub.actividadesCorrectivas ||
      sub.horasTrabajo ||
      sub.repuestos?.length
    );
  }

  // Punto 2: auto-expandir sub-órdenes "En Revisión de Cierre" al abrir el panel
  private readonly expandedSubOrders = signal<Set<string>>(
    new Set(
      this.data.order.subOrders
        .filter((s) => s.status === 'En Revisión de Cierre')
        .map((s) => s.id),
    ),
  );
  isExpanded(subId: string): boolean {
    return this.expandedSubOrders().has(subId);
  }
  toggleExpand(subId: string): void {
    this.expandedSubOrders.update((set) => {
      const next = new Set(set);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  }

  novedadFor(subOrder: SubOrder): string {
    if (subOrder.type === 'Mecánico') return this.report.problemasMecanica;
    if (subOrder.type === 'Instrumental') return this.report.problemasInstrumentacion;
    return this.report.problemasOperaciones;
  }

  deriveToPumping(sub: SubOrder): void {
    const ref = this.dialog.open<DeriveToPumpingDialog, DeriveToPumpingDialogData>({
      title: 'Derivar a Pumping — ' + sub.code,
      content: DeriveToPumpingDialog,
      data: { subOrder: sub },
      footer: false,
    });
    ref.afterClose.subscribe((changed) => {
      if (changed) this.refreshOrder();
    });
  }

  // ── Revisión inline ──
  startRejectMode(subId: string): void {
    this.rejectingSubId.set(subId);
    this.rejectionNote.set('');
  }

  cancelRejectMode(): void {
    this.rejectingSubId.set(null);
    this.rejectionNote.set('');
  }

  approveInline(sub: SubOrder): void {
    if (this.reviewing()) return;
    this.reviewing.set(true);
    this.ordersService.reviewSubOrder(sub.id, 'approved').subscribe({
      next: () => {
        this.reviewing.set(false);
        this.notify.success('Sub-orden cerrada', `${sub.code} quedó cerrada.`);
        this.refreshOrder();
      },
      error: (e) => {
        this.reviewing.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo cerrar la sub-orden.'));
      },
    });
  }

  confirmRejectionInline(sub: SubOrder): void {
    const note = this.rejectionNote().trim();
    if (!note || this.reviewing()) return;
    this.reviewing.set(true);
    this.ordersService.reviewSubOrder(sub.id, 'rejected', note).subscribe({
      next: () => {
        this.reviewing.set(false);
        this.rejectingSubId.set(null);
        this.rejectionNote.set('');
        this.notify.warning('Corrección solicitada', `${sub.code} regresa al operador.`);
        this.refreshOrder();
      },
      error: (e) => {
        this.reviewing.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo enviar la corrección.'));
      },
    });
  }

  returnToOperation(): void {
    const ref = this.dialog.open<ReturnToOperationDialog, ReturnToOperationDialogData>({
      title: 'Fin Correctivo — Retorno a Operación',
      content: ReturnToOperationDialog,
      data: { order: this.currentOrder() },
      footer: false,
    });
    ref.afterClose.subscribe((changed) => {
      if (changed) this.drawerRef.close();
    });
  }
}
