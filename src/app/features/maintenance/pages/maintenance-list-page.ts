import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDataTableProgressCell,
  DynadrillDialogService,
  DynadrillDrawerService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillStatisticComponent,
  DynadrillTabsComponent,
  DynadrillTagVariant,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, OrderStatus } from '../models/maintenance-order.model';
import { unitReportHasNovedades, UnitReport } from '../models/unit-report.model';
import { AlertaPreventiva, AlertaPreventivaNivel, calcularAlertas, Unidad } from '../models/unidad.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { UnidadesService } from '../services/unidades.service';
import { OrderDetailPanel, OrderDetailPanelData } from '../components/order-detail-panel';
import { OrderClassificationDialog, OrderClassificationDialogData } from '../components/order-classification-dialog';
import { MaintenanceReportDialog, MaintenanceReportDialogData } from '../components/maintenance-report-dialog';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ORDER_STATUS_TONE: Record<OrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'Requiere cambios': 'info',
  Aceptado: 'success',
  Rechazado: 'error',
  Cerrado: 'neutral',
};

@Component({
  selector: 'app-maintenance-list-page',
  imports: [DynadrillButtonComponent, DynadrillDataTableComponent, DynadrillIconButtonComponent, DynadrillKpiRowComponent, DynadrillScreenHeaderComponent, DynadrillSelectComponent, DynadrillSpinnerComponent, DynadrillStatisticComponent, DynadrillTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-list-page.html',
  styleUrl: './maintenance-list-page.scss',
})
export class MaintenanceListPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawer = inject(DynadrillDrawerService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);

  protected readonly alertas = computed<AlertaPreventiva[]>(() =>
    this.unidades().flatMap(u => calcularAlertas(u)).sort((a, b) => a.restante - b.restante)
  );

  protected readonly activeTab = signal(0);

  protected readonly tabs: DynadrillTab[] = [
    { label: 'Correctivo' },
    { label: 'Preventivo' },
  ];

  protected readonly alertasTone: Record<AlertaPreventivaNivel, DynadrillTagVariant> = {
    rojo: 'error',
    amarillo: 'warning',
    verde: 'success',
  };

  protected readonly alertasLabel: Record<AlertaPreventivaNivel, string> = {
    rojo: 'Vencido',
    amarillo: 'Próximo',
    verde: 'Al día',
  };

  protected readonly resumenPreventivo = computed(() => {
    const all = this.alertas();
    return {
      rojo:    all.filter(a => a.nivel === 'rojo').length,
      amarillo: all.filter(a => a.nivel === 'amarillo').length,
      verde:   all.filter(a => a.nivel === 'verde').length,
    };
  });

  // ── Preventivo: filtros y paginación ──

  protected readonly filtroNivel = signal<AlertaPreventivaNivel | null>(null);
  protected readonly filtroTipo = signal<string | number | null>(null);
  protected readonly prevPage = signal(1);
  protected readonly prevPageSize = 10;
  protected readonly sortDir = signal<'asc' | 'desc'>('asc');
  protected readonly sortKey = signal<keyof AlertaPreventiva>('restante');

  protected readonly tipoOptions: DynadrillSelectOption[] = [
    { label: 'Servicio', value: 'Servicio' },
    { label: 'Auxiliar', value: 'Auxiliar' },
    { label: 'Transporte', value: 'Transporte' },
  ];

  protected readonly prevColumns: DynadrillDataTableColumn[] = [
    { key: 'unidadCode', header: 'Unidad', sortable: true, searchable: true, fixed: 'left' },
    { key: 'descripcion', header: 'Mantenimiento', searchable: true },
    { key: 'progreso', header: 'Progreso', type: 'progress' },
    { key: 'actualLabel', header: 'Actual', sortable: true },
    { key: 'proximoEn', header: 'Próximo en', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge', fixed: 'right' },
  ];

  protected readonly prevRows = computed(() =>
    this.alertasFiltradas().map(a => ({
      id: `${a.unidadId}-${a.descripcion}`,
      unidadCode: a.unidadCode,
      descripcion: a.descripcion,
      progreso: { value: a.consumido, max: a.intervalo } satisfies DynadrillDataTableProgressCell,
      actualLabel: a.actualLabel,
      proximoEn: a.proximoEn,
      estadoBadge: { text: this.alertasLabel[a.nivel], tone: this.alertasTone[a.nivel] },
    })),
  );

  protected readonly prevRowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly alertasFiltradas = computed<AlertaPreventiva[]>(() => {
    let list = this.alertas();
    const nivel = this.filtroNivel();
    const tipo = this.filtroTipo();
    if (nivel) list = list.filter(a => a.nivel === nivel);
    if (tipo) list = list.filter(a => {
      const u = this.unidades().find(u => u.code === a.unidadCode);
      return u?.tipo === String(tipo);
    });
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[key] as number | string;
      const bv = b[key] as number | string;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  });

  protected readonly alertasPaginadas = computed(() => {
    const page = this.prevPage();
    const start = (page - 1) * this.prevPageSize;
    return this.alertasFiltradas().slice(start, start + this.prevPageSize);
  });

  protected readonly totalPages = computed(() =>
    Math.ceil(this.alertasFiltradas().length / this.prevPageSize),
  );

  toggleFiltroNivel(nivel: AlertaPreventivaNivel): void {
    this.filtroNivel.update(current => current === nivel ? null : nivel);
    this.prevPage.set(1);
  }

  toggleSort(key: keyof AlertaPreventiva): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: keyof AlertaPreventiva): string {
    if (this.sortKey() !== key) return '⇅';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  // Solo fijamos la columna de Orden + Acciones cuando la tabla realmente
  // podría no entrar en pantalla — en desktop `fixed`/scrollX forzaban un
  // scroll horizontal interno incluso sobrando espacio de sobra.
  private readonly narrowViewport = signal(window.matchMedia('(max-width: 840px)').matches);
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Orden', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'tipo', header: 'Tipo' },
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
        code: `R${r.reportNo}`,
        unidad: r.unidad,
        fecha: formatDate(r.createdAt),
        tipo: [
          r.problemasMecanica.trim() ? 'Mecánico' : '',
          r.problemasInstrumentacion.trim() ? 'Instrumental' : '',
          r.problemasOperaciones.trim() ? 'Operativo' : '',
        ].filter(Boolean).join(' · ') || '—',
        origin: r.sourceModule,
        statusBadge: r.dismissed
          ? { text: 'No requiere mantenimiento', tone: 'neutral' as DynadrillTagVariant }
          : { text: 'Pendiente de clasificar', tone: 'warning' as DynadrillTagVariant },
      }));

    const orderRows = this.orders().map(order => {
      const status = computeOrderStatus(order, order.subOrders);
      const tipos = [...new Set(order.subOrders.map(s => s.type))].join(' · ');
      return {
        kind: 'order' as const,
        id: `order-${order.id}`,
        orderId: order.id,
        code: order.code,
        unidad: order.unidad,
        fecha: formatDate(order.createdAt),
        tipo: tipos || '—',
        origin: order.sourceModule,
        statusBadge: { text: status, tone: ORDER_STATUS_TONE[status] },
      };
    });

    return [...reportRows, ...orderRows];
  });

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const pendientes = this.unitReports().filter(r => unitReportHasNovedades(r) && !r.dismissed && !this.orders().some(o => o.unitReportId === r.id)).length;
    const allOrders = this.orders();
    const activas = allOrders.filter(o => !o.returnedToOperation).length;
    const derivadas = allOrders.filter(o => o.subOrders.some(s => s.status === 'Derivado a Pumping')).length;
    const cerradas = allOrders.filter(o => o.returnedToOperation).length;
    return [
      { label: 'Pendiente de clasificar', value: pendientes },
      { label: 'Órdenes activas', value: activas },
      { label: 'Derivadas a Pumping', value: derivadas },
      { label: 'Cerradas', value: cerradas },
    ];
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
    forkJoin({
      orders: this.ordersService.list(),
      unitReports: this.unitReportsService.list(),
      unidades: this.unidadesService.list(),
    }).subscribe({
      next: ({ orders, unitReports, unidades }) => {
        this.orders.set(orders);
        this.unitReports.set(unitReports);
        this.unidades.set(unidades);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la bandeja de órdenes.');
      },
    });
  }

  /**
   * Enrutamiento inteligente según el tipo de fila:
   * - Reporte pendiente → modal de clasificación (novedades + Clasificar/Descartar en un solo paso)
   * - Orden clasificada → panel lateral (para ver y gestionar el estado de cada sub-orden)
   */
  viewDetail(row: Record<string, unknown>): void {
    const isOrder = row['kind'] === 'order';
    const order = isOrder ? this.orders().find(o => o.id === row['orderId']) : undefined;
    const unitReport = isOrder
      ? this.unitReports().find(r => r.id === order!.unitReportId)!
      : this.unitReports().find(r => r.id === row['reportId'])!;

    if (!isOrder) {
      const ref = this.dialogService.open<OrderClassificationDialog, OrderClassificationDialogData>({
        title: `Reporte N° ${unitReport.reportNo} — ${unitReport.unidad}`,
        content: OrderClassificationDialog,
        data: { unitReport },
        footer: false,
      });
      ref.afterClose.subscribe(changed => { if (changed) this.reload(); });
      return;
    }

    const ref = this.drawer.open<OrderDetailPanel, OrderDetailPanelData>({
      title: 'Detalle — ' + order!.code,
      content: OrderDetailPanel,
      data: { unitReport, order: order! },
      size: 'small',
    });
    ref.afterClose.subscribe(() => this.reload());
  }

  openReport(row: Record<string, unknown>): void {
    const order = this.orders().find(o => o.id === row['orderId']);
    if (!order) return;
    const unitReport = this.unitReports().find(r => r.id === order.unitReportId)!;
    this.dialogService.open<MaintenanceReportDialog, MaintenanceReportDialogData>({
      title: `Informe DYN-MNT-RE-008 — ${order.code}`,
      content: MaintenanceReportDialog,
      data: { order, unitReport },
      footer: false,
      width: '780px',
    });
  }
}
