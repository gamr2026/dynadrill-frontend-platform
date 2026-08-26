import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { SuborderExecutionDialog, SuborderExecutionDialogData } from '../components/suborder-execution-dialog';
import { SuborderDetailDialog, SuborderDetailDialogData } from '../components/suborder-detail-dialog';

const SUB_ORDER_STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  Cerrado: 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

/**
 * Vista del Operador de Mantenimiento — solo ve las sub-órdenes que el Jefe
 * le asignó a él (MAN-001-B: Diagnóstico y Ejecución). No ve la bandeja
 * completa ni puede clasificar/asignar/revisar — eso es del Jefe.
 */
@Component({
  selector: 'app-my-tasks-page',
  imports: [CommonModule, DynadrillDataTableComponent, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillScreenHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tasks-page.html',
  styleUrl: './my-tasks-page.scss',
})
export class MyTasksPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  /**
   * Sin fixed/scrollX: nzScroll.x hace que nz-table mida el ancho "natural"
   * de cada columna con un renglón oculto y lo fije en px vía colgroup —
   * esa medición no espera a que dynadrill-button termine de renderizar
   * dentro del actionsTemplate, así que la columna de Acciones quedaba
   * fijada a un ancho absurdamente angosto sin importar su contenido real.
   * El overflow-x horizontal en viewports angostos ahora lo da el wrapper
   * CSS de la plantilla (.table-scroll), no nz-table.
   */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Sub-orden', sortable: true, searchable: true },
    { key: 'orderCode', header: 'Orden', searchable: true },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'type', header: 'Tipo' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ]);

  protected readonly rows = computed(() => {
    const userId = this.auth.currentUser()?.id;
    return this.orders()
      .flatMap(order => order.subOrders.map(sub => ({ order, sub })))
      .filter(({ sub }) => sub.assignedUserId === userId)
      .map(({ order, sub }) => ({
        id: sub.id,
        code: sub.code,
        orderCode: order.code,
        unidad: order.unidad,
        type: sub.type,
        statusBadge: { text: sub.status, tone: SUB_ORDER_STATUS_TONE[sub.status] },
      }));
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
        this.notify.error('Error', 'No se pudieron cargar tus tareas.');
      },
    });
  }

  private subOrderFor(row: Record<string, unknown>): SubOrder {
    return this.orders().flatMap(o => o.subOrders).find(s => s.id === row['id'])!;
  }

  /** El operador puede abrir el dialog mientras no haya enviado a revisión ni esté Cerrado. */
  isActionable(row: Record<string, unknown>): boolean {
    const sub = this.subOrderFor(row);
    return sub.status === 'Pendiente'
      || sub.status === 'En Diagnóstico'
      || sub.status === 'En Ejecución'
      || sub.status === 'Corrección Solicitada';
  }

  /** Lo que reportó el operador en el Reporte de Unidad — nunca lo escribe Mantenimiento. */
  private novedadFor(subOrder: SubOrder): string {
    const order = this.orders().find(o => o.id === subOrder.orderId);
    const report = order && this.unitReports().find(r => r.id === order.unitReportId);
    if (!report) return '';
    if (subOrder.type === 'Mecánico') return report.problemasMecanica;
    if (subOrder.type === 'Instrumental') return report.problemasInstrumentacion;
    return report.problemasOperaciones;
  }

  viewDetail(row: Record<string, unknown>): void {
    const subOrder = this.subOrderFor(row);
    const order = this.orders().find(o => o.id === subOrder.orderId);
    this.dialog.open<SuborderDetailDialog, SuborderDetailDialogData>({
      title: 'Detalle — ' + subOrder.code,
      content: SuborderDetailDialog,
      data: { subOrder, orderCode: order?.code ?? '', novedadOriginal: this.novedadFor(subOrder) },
      footer: false,
    });
  }

  openExecution(row: Record<string, unknown>): void {
    const subOrder = this.subOrderFor(row);
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
}
