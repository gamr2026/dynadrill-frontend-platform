import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import {
  DynadrillButtonComponent,
  DynadrillChartComponent,
  DynadrillChartSeries,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDrawerService,
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

/** Hex plano (echarts pinta en <canvas>, fuera del árbol de estilos — un var(--…) no resuelve). Sincronizados con _tokens.less, igual que dashboard-page.ts. */
const TIPO_HEX: Record<string, string> = {
  Servicio: '#662e9b',
  Auxiliar: '#1890ff',
  Transporte: '#52c41a',
  'Sin tipo': '#bdbdbd',
};

const CAT_HEX = { Pesado: '#1890ff', Liviano: '#52c41a' } as const;

/**
 * Donut decorativo — mismo patrón que dashboard-page.ts: labels/leyenda
 * nativos apagados (la lectura real va en la lista de texto de al lado,
 * el canvas queda aria-hidden), sin agrandar el sector al pasar el mouse.
 */
function donutOptions(segments: { name: string; value: number; color: string }[]): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['60%', '90%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: false },
        data: segments.map(s => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      },
    ],
  };
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
    DynadrillButtonComponent,
    NgxEchartsDirective,
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

  private disponibilidadDe(unidades: Unidad[], orders: MaintenanceOrderWithSubOrders[]): number {
    const total = unidades.length;
    if (!total) return 0;
    const conOrdenAbierta = new Set(orders.filter(o => !o.returnedToOperation).map(o => o.unidad));
    const disponibles = unidades.filter(u => !conOrdenAbierta.has(u.code)).length;
    return Math.round((disponibles / total) * 100);
  }

  protected readonly disponibilidadFlota = computed(() => this.disponibilidadDe(this.filteredUnidades(), this.filteredOrders()));

  /**
   * Subclasificación pedida por el cliente en la presentación del módulo —
   * "ver más allá de cuántas hay disponibles o no". Solo Transporte tiene
   * categoriaPeso hoy, así que el desglose es independiente del filtro
   * "Tipo de unidad" de arriba (que sí puede excluir Transporte por completo).
   */
  protected readonly transporteUnidades = computed(() => this.unidades().filter(u => u.tipo === 'Transporte'));
  protected readonly transportePesados = computed(() => this.transporteUnidades().filter(u => u.categoriaPeso === 'Pesado'));
  protected readonly transporteLivianos = computed(() => this.transporteUnidades().filter(u => u.categoriaPeso === 'Liviano'));

  protected readonly disponibilidadPesados = computed(() => this.disponibilidadDe(this.transportePesados(), this.orders()));
  protected readonly disponibilidadLivianos = computed(() => this.disponibilidadDe(this.transporteLivianos(), this.orders()));

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

  private cumplimientoDe(unidades: Unidad[]): number {
    const all = unidades.flatMap(u => calcularAlertas(u));
    if (!all.length) return 0;
    const noVencidas = all.filter(a => a.nivel !== 'rojo').length;
    return Math.round((noVencidas / all.length) * 100);
  }

  protected readonly cumplimientoPreventivo = computed(() => this.cumplimientoDe(this.filteredUnidades()));
  protected readonly cumplimientoPesados = computed(() => this.cumplimientoDe(this.transportePesados()));
  protected readonly cumplimientoLivianos = computed(() => this.cumplimientoDe(this.transporteLivianos()));

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

  /**
   * Reparto de las órdenes de mantenimiento por tipo de unidad
   * (Servicio / Auxiliar / Transporte) — pastel para ver de un vistazo qué
   * segmento de la flota concentra la carga correctiva. Usa `orders()` sin
   * el filtro de tipo: filtrado dejaría el pastel de un solo color.
   */
  protected readonly ordenesPorTipoUnidad = computed(() => {
    const tipoPorCode = new Map(this.unidades().map(u => [u.code, u.tipo]));
    const conteo = new Map<string, number>();
    for (const o of this.orders()) {
      const tipo = tipoPorCode.get(o.unidad) ?? 'Sin tipo';
      conteo.set(tipo, (conteo.get(tipo) ?? 0) + 1);
    }
    return [...conteo.entries()].map(([tipo, cantidad]) => ({ tipo, cantidad }));
  });

  protected readonly ordenesPorTipoDonut = computed<EChartsCoreOption>(() =>
    donutOptions(this.ordenesPorTipoUnidad().map(s => ({
      name: s.tipo,
      value: s.cantidad,
      color: TIPO_HEX[s.tipo] ?? TIPO_HEX['Sin tipo'],
    }))),
  );

  protected readonly ordenesPorTipoLegend = computed(() =>
    this.ordenesPorTipoUnidad().map(s => ({
      text: `${s.cantidad} ${s.tipo}`,
      color: TIPO_HEX[s.tipo] ?? TIPO_HEX['Sin tipo'],
    })),
  );

  // ── Gauges seccionados por categoría de transporte (Pesado / Liviano) ──
  // Mismo donut decorativo + leyenda de texto que el Dashboard: el círculo
  // reparte las unidades por categoría, la leyenda lleva el % real de cada una.

  protected readonly hayTransporte = computed(() => this.transporteUnidades().length > 0);

  private categoriaDonut(): EChartsCoreOption {
    return donutOptions([
      { name: 'Pesados', value: this.transportePesados().length, color: CAT_HEX.Pesado },
      { name: 'Livianos', value: this.transporteLivianos().length, color: CAT_HEX.Liviano },
    ]);
  }

  protected readonly categoriaDonutOptions = computed<EChartsCoreOption>(() => this.categoriaDonut());

  protected readonly cumplimientoLegend = computed(() => [
    { text: `Pesados (${this.transportePesados().length}) — ${this.cumplimientoPesados()}%`, color: CAT_HEX.Pesado },
    { text: `Livianos (${this.transporteLivianos().length}) — ${this.cumplimientoLivianos()}%`, color: CAT_HEX.Liviano },
  ]);

  protected readonly disponibilidadLegend = computed(() => [
    { text: `Pesados (${this.transportePesados().length}) — ${this.disponibilidadPesados()}%`, color: CAT_HEX.Pesado },
    { text: `Livianos (${this.transporteLivianos().length}) — ${this.disponibilidadLivianos()}%`, color: CAT_HEX.Liviano },
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
