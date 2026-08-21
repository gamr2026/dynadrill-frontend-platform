import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import { DynadrillButtonComponent, DynadrillDialogService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, SubOrder } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { OrderClassificationDialog, OrderClassificationDialogData } from './order-classification-dialog';
import { AssignOperatorDialog, AssignOperatorDialogData } from './assign-operator-dialog';
import { DeriveToPumpingDialog, DeriveToPumpingDialogData } from './derive-to-pumping-dialog';
import { SuborderReviewDialog, SuborderReviewDialogData } from './suborder-review-dialog';
import { ReturnToOperationDialog, ReturnToOperationDialogData } from './return-to-operation-dialog';

export interface OrderDetailPanelData {
  kind: 'pending' | 'order';
  unitReport: UnitReport;
  /** Presente solo cuando kind === 'order'. */
  order?: MaintenanceOrderWithSubOrders;
}

/**
 * Panel maestro-detalle del Jefe de Mantenimiento — reemplaza la fila de
 * botones variables de la bandeja: un único botón "Ver" por registro abre
 * este panel, y todas las acciones (clasificar, asignar, revisar, derivar,
 * Fin Correctivo) viven adentro. Cada acción, al cerrar su diálogo, refresca
 * solo esta orden (no cierra el panel) salvo Clasificar — esa sí cierra el
 * panel porque el registro cambia de identidad (de "pendiente" a "orden").
 */
@Component({
  selector: 'app-order-detail-panel',
  imports: [DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail-panel.html',
  styleUrl: './order-detail-panel.scss',
})
export class OrderDetailPanel {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly drawerRef = inject(NzDrawerRef<OrderDetailPanel>);
  protected readonly data = inject<OrderDetailPanelData>(NZ_DRAWER_DATA);

  // Nombres distintos a los campos de OrderDetailPanelData a propósito: a diferencia de
  // DynadrillDialogService, el drawer de ng-zorro hace Object.assign(instancia, nzData) además
  // de inyectar NZ_DRAWER_DATA — si una propiedad se llamara igual que un campo del data (p.ej.
  // "order"), ese Object.assign pisaría la signal con el valor plano y rompía el componente.
  protected readonly report = this.data.unitReport;
  protected readonly currentOrder = signal<MaintenanceOrderWithSubOrders | undefined>(this.data.order);

  protected readonly orderStatus = computed(() => {
    const order = this.currentOrder();
    return order ? computeOrderStatus(order, order.subOrders) : undefined;
  });

  protected readonly isReadyToReturn = computed(() => this.orderStatus() === 'Aceptado');

  private refreshOrder(): void {
    const order = this.currentOrder();
    if (!order) return;
    this.ordersService.get(order.id).subscribe(updated => this.currentOrder.set(updated));
  }

  /** Lo que reportó el operador para el tipo de esta sub-orden — nunca lo escribe Mantenimiento. */
  novedadFor(subOrder: SubOrder): string {
    if (subOrder.type === 'Mecánico') return this.report.problemasMecanica;
    if (subOrder.type === 'Instrumental') return this.report.problemasInstrumentacion;
    return this.report.problemasOperaciones;
  }

  assignmentLabelFor(sub: SubOrder): string {
    if (sub.type === 'Operativo') return sub.status === 'Derivado a Pumping' ? 'Derivado a Pumping' : 'Pendiente de derivar a Pumping';
    return sub.assignedUserName ?? 'Sin asignar todavía';
  }

  /** Mecánico/Instrumental sin operador asignado todavía. */
  isAssignable(sub: SubOrder): boolean {
    return sub.type !== 'Operativo' && sub.status === 'Pendiente' && sub.assignedUserId == null;
  }

  /** Operativo recién clasificado — se deriva a Pumping, no se asigna a un operador interno. */
  isDerivable(sub: SubOrder): boolean {
    return sub.type === 'Operativo' && sub.status === 'Pendiente';
  }

  classify(): void {
    const ref = this.dialog.open<OrderClassificationDialog, OrderClassificationDialogData>({
      title: 'MAN-001-A — Revisión y Clasificación',
      content: OrderClassificationDialog,
      data: { unitReport: this.report },
      footer: false,
    });
    // El registro cambia de "pendiente" a "orden" — se cierra el panel y la
    // bandeja recarga, mostrando ya la orden clasificada como fila nueva.
    ref.afterClose.subscribe(changed => {
      if (changed) this.drawerRef.close();
    });
  }

  editClassification(): void {
    const order = this.currentOrder();
    if (!order) return;
    const ref = this.dialog.open<OrderClassificationDialog, OrderClassificationDialogData>({
      title: 'Editar clasificación — ' + order.code,
      content: OrderClassificationDialog,
      data: { unitReport: this.report, existingOrder: order },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.refreshOrder();
    });
  }

  assignOperator(sub: SubOrder): void {
    const ref = this.dialog.open<AssignOperatorDialog, AssignOperatorDialogData>({
      title: 'Asignar operador — ' + sub.code,
      content: AssignOperatorDialog,
      data: { subOrder: sub },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.refreshOrder();
    });
  }

  deriveToPumping(sub: SubOrder): void {
    const ref = this.dialog.open<DeriveToPumpingDialog, DeriveToPumpingDialogData>({
      title: 'Derivar a Pumping — ' + sub.code,
      content: DeriveToPumpingDialog,
      data: { subOrder: sub },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.refreshOrder();
    });
  }

  openReview(sub: SubOrder): void {
    const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
      title: 'MAN-001-C — Revisión de Cierre',
      content: SuborderReviewDialog,
      data: { subOrder: sub, novedadOriginal: this.novedadFor(sub) },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.refreshOrder();
    });
  }

  returnToOperation(): void {
    const order = this.currentOrder();
    if (!order) return;
    const ref = this.dialog.open<ReturnToOperationDialog, ReturnToOperationDialogData>({
      title: 'Fin Correctivo — Retorno a Operación',
      content: ReturnToOperationDialog,
      data: { order },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.refreshOrder();
    });
  }
}
