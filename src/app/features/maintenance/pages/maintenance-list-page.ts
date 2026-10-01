import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDataTableProgressCell,
  DynadrillDialogService,
  DynadrillDrawerService,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  DynadrillTagVariant,
  type DynadrillSelectOption,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../shared/components/kpi-stat/kpi-stat';
import { injectNarrowViewport } from '../../../core/utils/narrow-viewport.util';
import { QhseRegistrosMovil, type RegistroMovil } from '../../qhse/shared/components/qhse-registros-movil';
import { MntCompactList, type MntCompactItem } from '../components/mnt-compact-card';
import { AppNotificationItem, NotificationsService } from '../../../core/services/notifications.service';
import { computeOrderStatus, MaintenanceOrderWithSubOrders, OrderStatus } from '../models/maintenance-order.model';
import { unitReportCode, unitReportHasNovedades, UnitReport } from '../models/unit-report.model';
import { AlertaPreventiva, AlertaPreventivaNivel, calcularAlertas, Unidad } from '../models/unidad.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { UnidadesService } from '../services/unidades.service';
import { OrderDetailPanel, OrderDetailPanelData } from '../components/order-detail-panel';
import { OrderClassificationDialog, OrderClassificationDialogData } from '../components/order-classification-dialog';
import { DocumentoPdfService } from '../../../shared/documentos';
import { InformeMantenimientoHoja } from '../../../shared/documentos/formatos/informe-mantenimiento-hoja';
import { OrdenMantenimientoGeneralHoja } from '../../../shared/documentos/formatos/orden-mantenimiento-general-hoja';
import { OrdenMantenimientoOperativoHoja } from '../../../shared/documentos/formatos/orden-mantenimiento-operativo-hoja';
import { RegisterPMDialog, RegisterPMDialogData } from '../components/register-pm-dialog';
import { HistorialDialog, HistorialDialogData } from '../components/historial-dialog';
import { VehicleInspectionsTable } from '../components/vehicle-inspections-table';
import { VehicleInspectionsService } from '../services/vehicle-inspections.service';
import { ConductorPermisos, VehicleInspection, conductorPermisosPorVencer } from '../models/vehicle-inspection.model';
import { VehicleInspectionDialog, VehicleInspectionDialogData } from '../components/vehicle-inspection-dialog';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ORDER_STATUS_TONE: Record<OrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'En Mantenimiento': 'info',
  'Requiere cambios': 'info',
  Aceptado: 'success',
  Rechazado: 'error',
  Cerrado: 'neutral',
};

@Component({
  selector: 'app-maintenance-list-page',
  imports: [DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillDataTableComponent, PageHeader, KpiStat, QhseRegistrosMovil, MntCompactList, DynadrillSelectComponent, DynadrillSpinnerComponent, DynadrillTabsComponent, VehicleInspectionsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-list-page.html',
  styleUrl: './maintenance-list-page.scss',
})
export class MaintenanceListPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly inspectionsService = inject(VehicleInspectionsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawer = inject(DynadrillDrawerService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);

  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly inspections = signal<VehicleInspection[]>([]);
  /** Base de RRHH/QHSE simulada (ver vehicle-inspection.model.ts) — se carga acá también para poder alimentar la campana sin que nadie tenga que abrir una inspección primero. */
  protected readonly conductoresPermisos = signal<ConductorPermisos[]>([]);

  protected readonly alertas = computed<AlertaPreventiva[]>(() =>
    this.unidades().flatMap(u => calcularAlertas(u)).sort((a, b) => a.restante - b.restante)
  );

  protected readonly activeTab = signal(0);

  protected readonly tabs: DynadrillTab[] = [
    { label: 'Correctivo' },
    { label: 'Preventivo' },
    { label: 'Inspecciones' },
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

  /**
   * Sin fixed:'left'/'right' — combinar columnas nzLeft/nzRight mete a
   * nz-table en su modo interno "fixed-column", que le asigna un ancho en
   * px calculado a TODAS las columnas (incluida Acciones), sin conocer el
   * ancho real de los dynadrill-button con texto que trae ese template —
   * eso era lo que desbordaba/superponía la columna de acciones (y en un
   * intento de corregirlo solo por CSS, terminó rompiendo el offset
   * sticky de "Unidad" en vez de arreglar el ancho). scrollX se mantiene
   * para que la tabla completa siga haciendo scroll horizontal contenido
   * en viewports angostos, ahora con layout normal (auto), no fijo.
   */
  protected readonly prevColumns: DynadrillDataTableColumn[] = [
    { key: 'unidadCode', header: 'Unidad', sortable: true, searchable: true },
    { key: 'descripcion', header: 'Mantenimiento', searchable: true },
    { key: 'progreso', header: 'Progreso', type: 'progress' },
    { key: 'actualLabel', header: 'Actual', sortable: true },
    { key: 'proximoEn', header: 'Próximo en', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
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
      _alerta: a,
    })),
  );

  protected readonly prevRowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  /**
   * Pestaña Inspecciones — el Jefe solo tiene visibilidad. Abre el mismo diálogo que Pumping (DYN-SGI-RE-068, paso a
   * paso) en modo lectura, así ambos roles ven la inspección igual.
   */
  protected viewInspection(inspection: VehicleInspection): void {
    this.dialogService.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: 'Detalle de Inspección — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: { existing: inspection, readonly: true },
      size: 'large',
      footer: false,
    });
  }

  /** Historial de una unidad — accesible desde cualquier alerta de Preventivo que le pertenezca. */
  openHistorial(row: Record<string, unknown>): void {
    const alerta = row['_alerta'] as AlertaPreventiva;
    this.dialogService.open<HistorialDialog, HistorialDialogData>({
      title: 'Historial de mantenimiento',
      content: HistorialDialog,
      data: { unidadId: alerta.unidadId, unidadCode: alerta.unidadCode, unidadNombre: alerta.unidadNombre },
      footer: false,
      width: '640px',
    });
  }

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

  onTabChange(index: number): void {
    this.activeTab.set(index);
    this.filtroNivel.set(null);
    this.filtroTipo.set(null);
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

  /**
   * Sin fixed/scrollX: nzScroll.x hace que nz-table mida el ancho "natural"
   * de cada columna con un renglón oculto y lo fije en px vía colgroup —
   * esa medición no espera a que dynadrill-button termine de renderizar
   * dentro del actionsTemplate, así que la columna de Acciones quedaba
   * fijada a un ancho absurdamente angosto sin importar su contenido real
   * (texto montado, encabezado partido letra por letra). El overflow-x
   * horizontal en viewports angostos ahora lo da el wrapper CSS de la
   * plantilla, no nz-table.
   */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Orden', sortable: true, searchable: true },
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'origin', header: 'Origen' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ]);

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
        code: unitReportCode(r.reportNo),
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

  /** Tarjetas de color (Figma): pendiente en ámbar, activas en lila, derivadas en neutro y cerradas en verde. */
  protected readonly kpis = computed<{ label: string; value: number; caption: string; tone: KpiStatTone }[]>(() => {
    const pendientes = this.unitReports().filter(r => unitReportHasNovedades(r) && !r.dismissed && !this.orders().some(o => o.unitReportId === r.id)).length;
    const allOrders = this.orders();
    const activas = allOrders.filter(o => !o.returnedToOperation).length;
    const derivadas = allOrders.filter(o => o.subOrders.some(s => s.status === 'Derivado a Pumping')).length;
    const cerradas = allOrders.filter(o => o.returnedToOperation).length;
    return [
      { label: 'Pendiente de clasificar', value: pendientes, caption: 'Reportes nuevos', tone: 'warning' },
      { label: 'Órdenes activas', value: activas, caption: 'En curso', tone: 'brand' },
      { label: 'Derivadas a Pumping', value: derivadas, caption: 'Operativo', tone: 'neutral' },
      { label: 'Cerradas', value: cerradas, caption: 'Este mes', tone: 'success' },
    ];
  });

  /** Tarjetas de la bandeja Correctivo en móvil (Figma "M · Bandeja · Correctivo"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map(r => {
      const cerrada = r.statusBadge.text === 'Cerrado';
      return {
        id: r.id,
        eyebrow: r.code,
        title: r.unidad,
        subtitle: r.kind === 'pending' ? `Reporte de unidad · ${r.origin}` : `${r.tipo} · ${r.origin}`,
        status: r.statusBadge,
        fields: [
          { label: 'Fecha', value: r.fecha },
          { label: 'Tipo', value: r.tipo },
          { label: 'Origen', value: r.origin },
        ],
        actions: [
          cerrada && r.kind === 'order'
            ? { icon: 'file-text', label: 'Ver informe', primary: true, run: () => this.openReport(r) }
            : { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.viewDetail(r) },
        ],
      };
    }),
  );

  /** Filas del Preventivo en móvil (Figma "M · Preventivo"): registrar mantenimiento (✓) e historial (reloj). */
  protected readonly prevItemsMovil = computed<MntCompactItem[]>(() =>
    this.prevRows().map(r => ({
      id: r.id,
      title: `${r.unidadCode} · ${r.descripcion}`,
      lines: [`Actual ${r.actualLabel} · Próximo en ${r.proximoEn}`],
      chips: [r.estadoBadge as { text: string; tone: 'success' | 'warning' | 'error' }],
      actions: [
        { icon: 'check', label: 'Registrar mantenimiento', run: () => this.openRegisterPM(r) },
        { icon: 'clock', label: 'Ver historial', run: () => this.openHistorial(r) },
      ],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  /**
   * Fuente de avisos para la campana del Header (Fase 09.1): preventivos
   * vencidos, reportes sin clasificar y sub-órdenes en revisión de cierre.
   * El Header no conoce esta lógica — solo lee NotificationsService.items().
   */
  protected readonly notificationItems = computed<AppNotificationItem[]>(() => {
    const items: AppNotificationItem[] = [];

    for (const a of this.alertas().filter(a => a.nivel === 'rojo')) {
      items.push({
        id: `prev-${a.unidadId}-${a.descripcion}`,
        title: `${a.unidadCode} — mantenimiento vencido`,
        description: a.descripcion,
        tone: 'error',
        link: '/dashboard/mantenimiento',
      });
    }

    for (const r of this.unitReports().filter(r => unitReportHasNovedades(r) && !r.dismissed && !this.orders().some(o => o.unitReportId === r.id))) {
      items.push({
        id: `report-${r.id}`,
        title: `Reporte ${unitReportCode(r.reportNo)} sin clasificar`,
        description: r.unidad,
        tone: 'warning',
        link: '/dashboard/mantenimiento',
      });
    }

    for (const o of this.orders()) {
      for (const s of o.subOrders.filter(s => s.status === 'En Revisión de Cierre')) {
        items.push({
          id: `subrev-${s.id}`,
          title: `${s.code} en revisión de cierre`,
          description: o.unidad,
          tone: 'info',
          link: '/dashboard/mantenimiento',
        });
      }
    }

    /**
     * Permisos del conductor próximos a vencer (presentación del módulo,
     * 2026-09-01) — antes esta alerta solo se veía si alguien abría el
     * diálogo de Inspección de Vehículos con ese conductor seleccionado;
     * ahora también avisa por la campana sin que nadie tenga que abrirlo.
     */
    for (const c of this.conductoresPermisos()) {
      for (const p of conductorPermisosPorVencer(c)) {
        items.push({
          id: `permiso-${c.nombre}-${p.documento}`,
          title: `${c.nombre} — ${p.documento} por vencer`,
          description: `Vence en ${p.diasRestantes} ${p.diasRestantes === 1 ? 'día' : 'días'} (${p.vencimiento})`,
          tone: 'warning',
          link: '/dashboard/mantenimiento',
        });
      }
    }

    return items;
  });

  constructor() {
    this.reload();

    effect(() => this.notifications.setSource('maintenance', this.notificationItems()));
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('maintenance'));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      orders: this.ordersService.list(),
      unitReports: this.unitReportsService.list(),
      unidades: this.unidadesService.list(),
      inspections: this.inspectionsService.list(),
      conductoresPermisos: this.inspectionsService.listConductoresPermisos(),
    }).subscribe({
      next: ({ orders, unitReports, unidades, inspections, conductoresPermisos }) => {
        this.orders.set(orders);
        this.unitReports.set(unitReports);
        this.unidades.set(unidades);
        this.inspections.set(inspections);
        this.conductoresPermisos.set(conductoresPermisos);
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
        title: `Reporte ${unitReportCode(unitReport.reportNo)} — ${unitReport.unidad}`,
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

  openRegisterPM(row: Record<string, unknown>): void {
    const alerta = row['_alerta'] as AlertaPreventiva;
    const ref = this.dialogService.open<RegisterPMDialog, RegisterPMDialogData>({
      title: `Registrar PM — ${alerta.unidadCode}`,
      content: RegisterPMDialog,
      data: { alerta },
      footer: false,
    });
    ref.afterClose.subscribe(() => this.reload());
  }

  private readonly documentoPdf = inject(DocumentoPdfService);

  openReport(row: Record<string, unknown>): void {
    const order = this.orders().find(o => o.id === row['orderId']);
    if (!order) return;
    const unitReport = this.unitReports().find(r => r.id === order.unitReportId)!;
    this.documentoPdf.abrir({
      titulo: `Informe DYN-MNT-RE-008 — ${order.code}`,
      component: InformeMantenimientoHoja,
      inputs: { datos: { clase: 'Correctivo', order, unitReport } },
      nombreArchivo: `Informe de mantenimiento ${order.code}`,
    });
  }

  /** Orden de trabajo — Mantenimiento general (sub-órdenes Mecánico / Instrumental). */
  openOrdenGeneral(row: Record<string, unknown>): void {
    const order = this.orders().find(o => o.id === row['orderId']);
    if (!order) return;
    const unitReport = this.unitReports().find(r => r.id === order.unitReportId)!;
    this.documentoPdf.abrir({
      titulo: `Orden de trabajo — ${order.code}`,
      component: OrdenMantenimientoGeneralHoja,
      inputs: { order, unitReport },
      nombreArchivo: `Orden de trabajo ${order.code}`,
    });
  }

  /** Orden de mantenimiento operativo (sub-órdenes de tipo Operativo). */
  openOrdenOperativa(row: Record<string, unknown>): void {
    const order = this.orders().find(o => o.id === row['orderId']);
    if (!order) return;
    const unitReport = this.unitReports().find(r => r.id === order.unitReportId)!;
    this.documentoPdf.abrir({
      titulo: `Orden de mantenimiento operativo — ${order.code}`,
      component: OrdenMantenimientoOperativoHoja,
      inputs: { order, unitReport },
      nombreArchivo: `Orden de mantenimiento operativo ${order.code}`,
    });
  }

  tieneSubOrden(row: Record<string, unknown>, operativa: boolean): boolean {
    const order = this.orders().find(o => o.id === row['orderId']);
    return !!order?.subOrders.some(s => (s.type === 'Operativo') === operativa);
  }
}
