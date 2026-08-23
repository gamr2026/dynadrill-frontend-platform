import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import {
  DynadrillAvatarComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { DeriveToPumpingDialog, DeriveToPumpingDialogData } from './derive-to-pumping-dialog';
import { SuborderReviewDialog, SuborderReviewDialogData } from './suborder-review-dialog';
import { ReturnToOperationDialog, ReturnToOperationDialogData } from './return-to-operation-dialog';
import { RolesService, UsersService } from '../../users/services/users.service';
import { AuthService } from '../../../core/services/auth.service';

export interface OrderDetailPanelData {
  unitReport: UnitReport;
  order: MaintenanceOrderWithSubOrders;
}

const STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  'Pendiente': 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  'Cerrado': 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

const STATUS_ACCENT: Record<SubOrderStatus, 'warning' | 'info' | 'brand' | 'success' | 'error' | 'neutral' | 'none'> = {
  'Pendiente': 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  'Cerrado': 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

@Component({
  selector: 'app-order-detail-panel',
  imports: [
    DynadrillTextComponent,
    DynadrillButtonComponent,
    DynadrillTagComponent,
    DynadrillSelectComponent,
    DynadrillCardComponent,
    DynadrillAvatarComponent,
    DynadrillIconButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-panel.html',
  styleUrl: './order-detail-panel.scss',
})
export class OrderDetailPanel {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly drawerRef = inject(NzDrawerRef<OrderDetailPanel>);
  private readonly auth = inject(AuthService);
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  protected readonly data = inject<OrderDetailPanelData>(NZ_DRAWER_DATA);

  protected readonly report = this.data.unitReport;
  protected readonly currentOrder = signal<MaintenanceOrderWithSubOrders>(this.data.order);

  protected readonly orderStatus = computed(() =>
    computeOrderStatus(this.currentOrder(), this.currentOrder().subOrders),
  );
  protected readonly isReadyToReturn = computed(() => this.orderStatus() === 'Aceptado');

  // ── Edición inline de operador por sub-orden ──
  protected readonly editingSubId = signal<number | null>(null);
  protected readonly editingOperatorId = signal<number | null>(null);
  protected readonly reassigning = signal(false);
  protected readonly mecanicoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly instrumentalOptions = signal<DynadrillSelectOption[]>([]);

  protected readonly statusTone = STATUS_TONE;
  protected readonly statusAccent = STATUS_ACCENT;

  constructor() {
    const OPERATOR_ROLE = 'Operador de Mantenimiento';
    this.rolesService.list().subscribe(roles => {
      const role = roles.find(r => r.name === OPERATOR_ROLE);
      this.usersService.list().subscribe(users => {
        const active = users.filter(u => u.status && u.roleId === role?.id);
        this.mecanicoOptions.set(active.filter(u => u.specialty === 'Mecánico').map(u => ({ label: u.name, value: u.id })));
        this.instrumentalOptions.set(active.filter(u => u.specialty === 'Instrumental').map(u => ({ label: u.name, value: u.id })));
      });
    });
  }

  private refreshOrder(): void {
    this.ordersService.get(this.currentOrder().id).subscribe(updated => this.currentOrder.set(updated));
  }

  operatorOptionsFor(sub: SubOrder): DynadrillSelectOption[] {
    return sub.type === 'Mecánico' ? this.mecanicoOptions() : this.instrumentalOptions();
  }

  startEditOperator(sub: SubOrder): void {
    this.editingSubId.set(sub.id);
    this.editingOperatorId.set(sub.assignedUserId ?? null);
  }

  cancelEditOperator(): void {
    this.editingSubId.set(null);
    this.editingOperatorId.set(null);
  }

  saveOperator(sub: SubOrder): void {
    const newId = this.editingOperatorId();
    if (!newId || this.reassigning()) return;
    const opts = this.operatorOptionsFor(sub);
    const opt = opts.find(o => o.value === newId);
    if (!opt) return;
    this.reassigning.set(true);
    this.ordersService.reassignOperator(sub.id, newId, String(opt.label), this.auth.currentUser()?.name ?? '').subscribe({
      next: () => {
        this.editingSubId.set(null);
        this.editingOperatorId.set(null);
        this.reassigning.set(false);
        this.refreshOrder();
      },
      error: () => this.reassigning.set(false),
    });
  }

  isDerivable(sub: SubOrder): boolean {
    return sub.type === 'Operativo' && sub.status === 'Pendiente';
  }

  canEditOperator(sub: SubOrder): boolean {
    return sub.type !== 'Operativo' && sub.status !== 'Cerrado' && sub.status !== 'Derivado a Pumping';
  }

  hasProgress(sub: SubOrder): boolean {
    return !!(sub.diagnostico || sub.actividadesCorrectivas || sub.horasTrabajo || sub.repuestos?.length);
  }

  private readonly expandedSubOrders = signal<Set<number>>(new Set());
  isExpanded(subId: number): boolean { return this.expandedSubOrders().has(subId); }
  toggleExpand(subId: number): void {
    this.expandedSubOrders.update(set => {
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
    ref.afterClose.subscribe(changed => { if (changed) this.refreshOrder(); });
  }

  openReview(sub: SubOrder): void {
    const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
      title: 'MAN-001-C — Revisión de Cierre',
      content: SuborderReviewDialog,
      data: { subOrder: sub, novedadOriginal: this.novedadFor(sub) },
      footer: false,
    });
    ref.afterClose.subscribe(changed => { if (changed) this.refreshOrder(); });
  }

  returnToOperation(): void {
    const ref = this.dialog.open<ReturnToOperationDialog, ReturnToOperationDialogData>({
      title: 'Fin Correctivo — Retorno a Operación',
      content: ReturnToOperationDialog,
      data: { order: this.currentOrder() },
      footer: false,
    });
    ref.afterClose.subscribe(changed => { if (changed) this.drawerRef.close(); });
  }
}
