import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillTagVariant,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, OrderStatus, SubOrder } from '../models/maintenance-order.model';
import { unitReportHasNovedades, UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { OrderClassificationDialog, OrderClassificationDialogData } from '../components/order-classification-dialog';
import { SuborderExecutionDialog, SuborderExecutionDialogData } from '../components/suborder-execution-dialog';
import { SuborderReviewDialog, SuborderReviewDialogData } from '../components/suborder-review-dialog';

const ORDER_STATUS_TONE: Record<OrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'Requiere cambios': 'info',
  Aceptado: 'success',
  Rechazado: 'error',
};

@Component({
  selector: 'app-maintenance-list-page',
  imports: [CommonModule, DynadrillTextComponent, DynadrillDataTableComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-list-page.html',
  styleUrl: './maintenance-list-page.scss',
})
export class MaintenanceListPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Orden', sortable: true, searchable: true },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'origin', header: 'Origen' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  /**
   * Una sola tabla: reportes con novedad mezclados con las órdenes que ya
   * generaron. Los descartados ("No requiere mantenimiento") se quedan
   * visibles con su propio estado y motivo — si Operaciones pregunta
   * después por qué se rechazó un caso, Mantenimiento debe poder
   * consultarlo, no que el registro simplemente desaparezca.
   */
  protected readonly rows = computed(() => {
    const classifiedReportIds = new Set(this.orders().map(o => o.unitReportId));
    const reportRows = this.unitReports()
      .filter(r => unitReportHasNovedades(r) && !classifiedReportIds.has(r.id))
      .map(r => ({
        kind: 'pending' as const,
        id: `report-${r.id}`,
        reportId: r.id,
        code: '—',
        unidad: r.unidad,
        origin: '—',
        statusBadge: r.dismissed
          ? { text: 'No requiere mantenimiento', tone: 'neutral' as DynadrillTagVariant }
          : { text: 'Pendiente de clasificar', tone: 'warning' as DynadrillTagVariant },
      }));

    const orderRows = this.orders().map(order => ({
      kind: 'order' as const,
      id: `order-${order.id}`,
      orderId: order.id,
      code: order.code,
      unidad: order.unidad,
      origin: order.origin,
      statusBadge: { text: computeOrderStatus(order.subOrders), tone: ORDER_STATUS_TONE[computeOrderStatus(order.subOrders)] },
    }));

    return [...reportRows, ...orderRows];
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ orders: this.ordersService.list(), unitReports: this.unitReportsService.list() }).subscribe({
      next: ({ orders, unitReports }) => {
        this.orders.set(orders);
        this.unitReports.set(unitReports);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la bandeja de órdenes.');
      },
    });
  }

  isReportRow(row: Record<string, unknown>): boolean {
    return row['kind'] === 'pending';
  }

  isOrderRow(row: Record<string, unknown>): boolean {
    return row['kind'] === 'order';
  }

  orderFor(row: Record<string, unknown>): MaintenanceOrderWithSubOrders {
    return this.orders().find(o => o.id === row['orderId'])!;
  }

  isUnclassified(row: Record<string, unknown>): boolean {
    return this.isReportRow(row) && !this.reportFor(row).dismissed;
  }

  isDismissed(row: Record<string, unknown>): boolean {
    return this.isReportRow(row) && this.reportFor(row).dismissed;
  }

  subOrdersFor(row: Record<string, unknown>): SubOrder[] {
    if (row['kind'] !== 'order') return [];
    return this.orders().find(o => o.id === row['orderId'])?.subOrders ?? [];
  }

  reportFor(row: Record<string, unknown>): UnitReport {
    return this.unitReports().find(r => r.id === row['reportId'])!;
  }

  showDismissReason(row: Record<string, unknown>): void {
    const report = this.reportFor(row);
    this.notify.info('Motivo del descarte', report.dismissReason || '(sin motivo registrado)');
  }

  /** Lo que reportó el operador para el tipo de esta sub-orden — nunca lo escribe Mantenimiento. */
  private novedadFor(subOrder: SubOrder): string {
    const order = this.orders().find(o => o.id === subOrder.orderId);
    const report = order && this.unitReports().find(r => r.id === order.unitReportId);
    if (!report) return '';
    if (subOrder.type === 'Mecánico') return report.problemasMecanica;
    if (subOrder.type === 'Instrumental') return report.problemasInstrumentacion;
    return report.problemasOperaciones;
  }

  classify(report: UnitReport): void {
    const ref = this.dialog.open<OrderClassificationDialog, OrderClassificationDialogData>({
      title: 'MAN-001-A — Revisión y Clasificación',
      content: OrderClassificationDialog,
      data: { unitReport: report },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.reload();
    });
  }

  editClassification(order: MaintenanceOrderWithSubOrders): void {
    const report = this.unitReports().find(r => r.id === order.unitReportId)!;
    const ref = this.dialog.open<OrderClassificationDialog, OrderClassificationDialogData>({
      title: 'Editar clasificación — ' + order.code,
      content: OrderClassificationDialog,
      data: { unitReport: report, existingOrder: order },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.reload();
    });
  }

  openExecution(subOrder: SubOrder): void {
    const ref = this.dialog.open<SuborderExecutionDialog, SuborderExecutionDialogData>({
      title: 'MAN-001-B — Diagnóstico y Ejecución',
      content: SuborderExecutionDialog,
      data: { subOrder, novedadOriginal: this.novedadFor(subOrder) },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.reload();
    });
  }

  openReview(subOrder: SubOrder): void {
    const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
      title: 'MAN-001-C — Revisión de Cierre',
      content: SuborderReviewDialog,
      data: { subOrder, novedadOriginal: this.novedadFor(subOrder) },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.reload();
    });
  }
}
