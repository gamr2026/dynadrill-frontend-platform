import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDrawerService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillTagVariant,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, OrderStatus } from '../models/maintenance-order.model';
import { unitReportHasNovedades, UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { OrderDetailPanel, OrderDetailPanelData } from '../components/order-detail-panel';

const ORDER_STATUS_TONE: Record<OrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'Requiere cambios': 'info',
  Aceptado: 'success',
  Rechazado: 'error',
  Cerrado: 'neutral',
};

@Component({
  selector: 'app-maintenance-list-page',
  imports: [DynadrillTextComponent, DynadrillDataTableComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-list-page.html',
  styleUrl: './maintenance-list-page.scss',
})
export class MaintenanceListPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawer = inject(DynadrillDrawerService);

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  // Solo fijamos la columna de Orden + Acciones cuando la tabla realmente
  // podría no entrar en pantalla — en desktop `fixed`/scrollX forzaban un
  // scroll horizontal interno incluso sobrando espacio de sobra.
  private readonly narrowViewport = signal(window.matchMedia('(max-width: 840px)').matches);
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Orden', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'origin', header: 'Origen' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ]);
  protected readonly tableScrollX = computed(() => (this.narrowViewport() ? '640px' : undefined));

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

    const orderRows = this.orders().map(order => {
      const status = computeOrderStatus(order, order.subOrders);
      return {
        kind: 'order' as const,
        id: `order-${order.id}`,
        orderId: order.id,
        code: order.code,
        unidad: order.unidad,
        origin: order.origin,
        statusBadge: { text: status, tone: ORDER_STATUS_TONE[status] },
      };
    });

    return [...reportRows, ...orderRows];
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();

    const mq = window.matchMedia('(max-width: 840px)');
    const onChange = (e: MediaQueryListEvent): void => this.narrowViewport.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
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

  /** Único punto de entrada por fila — todas las acciones (clasificar, asignar, revisar, Fin Correctivo) viven en el panel. */
  viewDetail(row: Record<string, unknown>): void {
    const isOrder = row['kind'] === 'order';
    const order = isOrder ? this.orders().find(o => o.id === row['orderId']) : undefined;
    const unitReport = isOrder
      ? this.unitReports().find(r => r.id === order!.unitReportId)!
      : this.unitReports().find(r => r.id === row['reportId'])!;

    const ref = this.drawer.open<OrderDetailPanel, OrderDetailPanelData>({
      title: isOrder ? 'Detalle — ' + order!.code : 'Detalle — ' + unitReport.unidad,
      content: OrderDetailPanel,
      data: isOrder ? { kind: 'order', unitReport, order: order! } : { kind: 'pending', unitReport },
      size: 'small',
    });
    ref.afterClose.subscribe(() => this.reload());
  }
}
