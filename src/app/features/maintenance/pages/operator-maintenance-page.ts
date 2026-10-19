import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { injectNarrowViewport } from '../../../core/utils/narrow-viewport.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../qhse/shared/components/qhse-registros-movil';
import { AuthService } from '../../../core/services/auth.service';
import {
  NotificationsService,
  AppNotificationItem,
} from '../../../core/services/notifications.service';
import {
  MaintenanceOrderWithSubOrders,
  SubOrder,
  SubOrderStatus,
} from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import {
  SuborderExecutionDialog,
  SuborderExecutionDialogData,
} from '../components/suborder-execution-dialog';
import {
  SuborderDetailDialog,
  SuborderDetailDialogData,
} from '../components/suborder-detail-dialog';

const STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  Cerrado: 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'warning',
};

/**
 * Vista del Operador (Pumping/FCR) — muestra las sub-órdenes de tipo
 * "Operativo" derivadas a Pumping. El Operador puede ejecutar el
 * mantenimiento y enviarlo a revisión del Jefe de Mantenimiento (mismo
 * flujo que el Operador de Mantenimiento en my-tasks-page).
 */
@Component({
  selector: 'app-operator-maintenance-page',
  imports: [
    PageHeader,
    QhseRegistrosMovil,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operator-maintenance-page.html',
  styleUrl: './operator-maintenance-page.scss',
})
export class OperatorMaintenancePage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);

  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Sub-orden', sortable: true, searchable: true },
    { key: 'orderCode', header: 'Orden' },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
    { key: 'deriveNote', header: 'Nota de derivación' },
  ]);

  /** Muestra TODAS las sub-órdenes Operativo (en cualquier estado post-derivación). */
  protected readonly rows = computed(() => {
    return this.orders().flatMap((order) =>
      order.subOrders
        .filter((sub) => sub.type === 'Operativo' && sub.status !== 'Pendiente')
        .map((sub) => ({
          id: sub.id,
          code: sub.code,
          orderCode: order.code,
          unidad: order.unidad,
          statusBadge: { text: sub.status, tone: STATUS_TONE[sub.status] },
          deriveNote: sub.deriveNote || '—',
        })),
    );
  });

  /** Tarjetas en móvil (Figma "M · Mantenimiento Operativo"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map((r) => ({
      id: r.id,
      eyebrow: r.code,
      title: r.unidad,
      subtitle: `Orden ${r.orderCode}`,
      status: r.statusBadge,
      fields: r.deriveNote !== '—' ? [{ label: 'Nota de derivación', value: r.deriveNote }] : [],
      actions: this.isActionable(r)
        ? [
            {
              icon: 'tool',
              label: 'Diagnosticar / Ejecutar',
              primary: true,
              run: () => this.openExecution(r),
            },
            { icon: 'eye', label: 'Ver detalle', run: () => this.viewDetail(r) },
          ]
        : [{ icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.viewDetail(r) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  // Notificaciones — solo las que están pendientes de acción del operador
  private readonly notificationItems = computed<AppNotificationItem[]>(() => {
    const actionable = this.orders().flatMap((order) =>
      order.subOrders
        .filter(
          (sub) =>
            sub.type === 'Operativo' &&
            (sub.status === 'Derivado a Pumping' || sub.status === 'Corrección Solicitada'),
        )
        .map((sub) => ({ sub, order })),
    );
    return actionable.map(({ sub, order }) => ({
      id: `op-maint-${sub.id}`,
      title:
        sub.status === 'Corrección Solicitada'
          ? 'Corrección solicitada'
          : 'Mantenimiento operativo asignado',
      description: `Unidad ${order.unidad} — ${sub.deriveNote || sub.code}`,
      tone: (sub.status === 'Corrección Solicitada' ? 'error' : 'warning') as 'error' | 'warning',
      link: '/dashboard/mantenimiento/operativo',
    }));
  });

  constructor() {
    this.reload();

    effect(() => {
      this.notifications.setSource('operator-maintenance', this.notificationItems());
    });
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('operator-maintenance'));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      orders: this.ordersService.list(),
      unitReports: this.unitReportsService.list(),
    }).subscribe({
      next: ({ orders, unitReports }) => {
        this.orders.set(orders);
        this.unitReports.set(unitReports);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los mantenimientos operativos.');
      },
    });
  }

  private subOrderFor(row: Record<string, unknown>): SubOrder {
    return this.orders()
      .flatMap((o) => o.subOrders)
      .find((s) => s.id === row['id'])!;
  }

  private novedadFor(subOrder: SubOrder): string {
    const order = this.orders().find((o) => o.id === subOrder.orderId);
    const report = order && this.unitReports().find((r) => r.id === order.unitReportId);
    return report?.problemasOperaciones || '';
  }

  /** El operador puede ejecutar si la sub-orden no está en revisión ni cerrada. */
  isActionable(row: Record<string, unknown>): boolean {
    const sub = this.subOrderFor(row);
    return (
      sub.status === 'Derivado a Pumping' ||
      sub.status === 'En Diagnóstico' ||
      sub.status === 'En Ejecución' ||
      sub.status === 'Corrección Solicitada'
    );
  }

  protected viewDetail(row: Record<string, unknown>): void {
    const subOrder = this.subOrderFor(row);
    const order = this.orders().find((o) => o.id === subOrder.orderId);
    this.dialog.open<SuborderDetailDialog, SuborderDetailDialogData>({
      title: 'Detalle — ' + subOrder.code,
      content: SuborderDetailDialog,
      data: { subOrder, orderCode: order?.code ?? '', novedadOriginal: this.novedadFor(subOrder) },
      footer: false,
    });
  }

  protected openExecution(row: Record<string, unknown>): void {
    const subOrder = this.subOrderFor(row);
    const ref = this.dialog.open<SuborderExecutionDialog, SuborderExecutionDialogData>({
      title: 'Mantenimiento Operativo — Diagnóstico y Ejecución',
      content: SuborderExecutionDialog,
      data: { subOrder, novedadOriginal: this.novedadFor(subOrder) },
      footer: false,
    });
    ref.afterClose.subscribe((changed) => {
      if (changed) this.reload();
    });
  }
}
