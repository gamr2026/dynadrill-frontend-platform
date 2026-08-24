import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillChartComponent,
  DynadrillChartSeries,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDrawerService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { Unidad, calcularAlertas } from '../models/unidad.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { UnidadesService } from '../services/unidades.service';
import { OrderDetailPanel, OrderDetailPanelData } from '../components/order-detail-panel';

function hoursBetween(aIso: string, bIso: string): number {
  return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3_600_000;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/**
 * Fase 10 — KPIs de MAN-MASTER-001. Se calculan sobre datos del
 * interceptor de mocks: sirven para validar la definición de cada
 * indicador con el cliente, no para tomar decisiones — se reinician al
 * refrescar la página porque no hay persistencia real todavía.
 */
@Component({
  selector: 'app-maintenance-kpis-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillSpinnerComponent,
    DynadrillTextComponent,
    DynadrillChartComponent,
    DynadrillDataTableComponent,
    DynadrillSelectComponent,
    DynadrillIconButtonComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-kpis-page.html',
  styleUrl: './maintenance-kpis-page.scss',
})
export class MaintenanceKpisPage {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawer = inject(DynadrillDrawerService);

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);

  // ── Filtro por tipo de unidad ──

  protected readonly tipoOptions: DynadrillSelectOption[] = [
    { label: 'Servicio', value: 'Servicio' },
    { label: 'Auxiliar', value: 'Auxiliar' },
    { label: 'Transporte', value: 'Transporte' },
  ];
  protected readonly filtroTipo = signal<string | number | null>(null);

  protected readonly filteredUnidades = computed(() => {
    const tipo = this.filtroTipo();
    return tipo ? this.unidades().filter(u => u.tipo === String(tipo)) : this.unidades();
  });

  protected readonly filteredOrders = computed(() => {
    const tipo = this.filtroTipo();
    if (!tipo) return this.orders();
    const codes = new Set(this.filteredUnidades().map(u => u.code));
    return this.orders().filter(o => codes.has(o.unidad));
  });

  constructor() {
    this.reload();
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
        this.notify.error('Error', 'No se pudieron cargar los indicadores.');
      },
    });
  }

  // ── De proceso ──

  protected readonly tiempoGeneracionOrden = computed(() => {
    const horas = this.filteredOrders()
      .map(o => {
        const report = this.unitReports().find(r => r.id === o.unitReportId);
        return report ? hoursBetween(report.createdAt, o.createdAt) : null;
      })
      .filter((h): h is number => h !== null && h >= 0);
    return average(horas);
  });

  protected readonly tiempoDiagnostico = computed(() => {
    const horas = this.filteredOrders().flatMap(o =>
      o.subOrders
        .filter(s => s.ejecucionIniciadaEn)
        .map(s => hoursBetween(o.createdAt, s.ejecucionIniciadaEn!)),
    ).filter(h => h >= 0);
    return average(horas);
  });

  protected readonly tiempoReparacion = computed(() => {
    const horas = this.filteredOrders().flatMap(o =>
      o.subOrders
        .filter(s => s.ejecucionIniciadaEn && s.ejecucionTerminadaEn)
        .map(s => hoursBetween(s.ejecucionIniciadaEn!, s.ejecucionTerminadaEn!)),
    ).filter(h => h >= 0);
    return average(horas);
  });

  // ── De flota / confiabilidad ──

  protected readonly mttrHoras = computed(() => {
    const horas = this.filteredOrders()
      .filter(o => o.closedAt)
      .map(o => hoursBetween(o.createdAt, o.closedAt!));
    return average(horas);
  });

  /** MTBF aproximado: promedio de días entre creación de órdenes consecutivas, por unidad. */
  protected readonly mtbfDias = computed(() => {
    const porUnidad = new Map<string, string[]>();
    for (const o of this.filteredOrders()) {
      porUnidad.set(o.unidad, [...(porUnidad.get(o.unidad) ?? []), o.createdAt]);
    }
    const gaps: number[] = [];
    for (const fechas of porUnidad.values()) {
      const ordenadas = [...fechas].sort();
      for (let i = 1; i < ordenadas.length; i++) {
        gaps.push(hoursBetween(ordenadas[i - 1], ordenadas[i]));
      }
    }
    return average(gaps) / 24;
  });

  protected readonly disponibilidadFlota = computed(() => {
    const total = this.filteredUnidades().length;
    if (!total) return 0;
    const conOrdenAbierta = new Set(this.filteredOrders().filter(o => !o.returnedToOperation).map(o => o.unidad));
    const disponibles = this.filteredUnidades().filter(u => !conOrdenAbierta.has(u.code)).length;
    return Math.round((disponibles / total) * 100);
  });

  protected readonly fallasRepetitivas = computed(() => {
    const porUnidad = new Map<string, number>();
    for (const o of this.filteredOrders()) {
      porUnidad.set(o.unidad, (porUnidad.get(o.unidad) ?? 0) + 1);
    }
    return [...porUnidad.entries()]
      .map(([unidad, cantidad]) => ({ unidad, cantidad }))
      .filter(r => r.cantidad > 1)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  });

  // ── De cumplimiento preventivo ──

  protected readonly alertas = computed(() => this.filteredUnidades().flatMap(u => calcularAlertas(u)));

  protected readonly cumplimientoPreventivo = computed(() => {
    const all = this.alertas();
    if (!all.length) return 0;
    const noVencidas = all.filter(a => a.nivel !== 'rojo').length;
    return Math.round((noVencidas / all.length) * 100);
  });

  protected readonly alertasGeneradas = computed(() => this.alertas().length);

  // ── KPI row + charts ──

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => [
    { label: 'Generación de orden (prom.)', value: `${this.tiempoGeneracionOrden().toFixed(1)} h` },
    { label: 'Diagnóstico (prom.)', value: `${this.tiempoDiagnostico().toFixed(1)} h` },
    { label: 'Reparación (prom.)', value: `${this.tiempoReparacion().toFixed(1)} h` },
    { label: 'MTTR', value: `${this.mttrHoras().toFixed(1)} h` },
    { label: 'MTBF', value: `${this.mtbfDias().toFixed(1)} d` },
    { label: 'Alertas preventivas generadas', value: this.alertasGeneradas() },
  ]);

  protected readonly fallasChartCategories = computed(() => this.fallasRepetitivas().map(r => r.unidad));
  protected readonly fallasChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Órdenes', data: this.fallasRepetitivas().map(r => r.cantidad) },
  ]);

  protected readonly fallasColumns: DynadrillDataTableColumn[] = [
    { key: 'unidad', header: 'Unidad', sortable: true },
    { key: 'cantidad', header: 'N° de órdenes', sortable: true },
  ];
  protected readonly fallasRowKeyFn = (row: Record<string, unknown>): string => String(row['unidad']);

  /** Abre la orden más reciente de esta unidad — mismo panel que usa la Bandeja. */
  openUnitOrder(row: Record<string, unknown>): void {
    const unidad = String(row['unidad']);
    const unitOrders = this.filteredOrders().filter(o => o.unidad === unidad);
    const latest = [...unitOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!latest) return;
    const unitReport = this.unitReports().find(r => r.id === latest.unitReportId);
    if (!unitReport) return;

    this.drawer.open<OrderDetailPanel, OrderDetailPanelData>({
      title: 'Detalle — ' + latest.code,
      content: OrderDetailPanel,
      data: { unitReport, order: latest },
      size: 'small',
    });
  }
}
