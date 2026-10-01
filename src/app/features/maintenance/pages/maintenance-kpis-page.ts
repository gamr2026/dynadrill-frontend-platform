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
  DynadrillDatetimePickerComponent,
  DynadrillDrawerService,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../shared/components/kpi-stat/kpi-stat';
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

/** Verde = estado sano (cumple / disponible), rojo = estado en alerta. Sincronizados con success/error de _tokens.less, igual que dashboard-page.ts. */
const ESTADO_HEX = { ok: '#52c41a', alerta: '#ff4d4f' } as const;

/** Leyenda de texto del pastel: "Cumplen — 8 (80%)". El % se saca sobre el total de la propia leyenda. */
function conPorcentaje(items: { text: string; value: number; color: string }[]): { text: string; color: string }[] {
  const total = items.reduce((acc, i) => acc + i.value, 0);
  return items.map(i => ({
    text: total ? `${i.text} — ${i.value} (${Math.round((i.value / total) * 100)}%)` : `${i.text} — ${i.value}`,
    color: i.color,
  }));
}

/**
 * Pastel de dos sectores para clasificar unidades por estado (cumple/no
 * cumple, disponible/no disponible). A diferencia del donut decorativo de
 * "Órdenes por tipo de unidad", este SÍ lleva tooltip activo: al pasar el mouse sobre un sector
 * lista los códigos de las unidades que caen en ese grupo (decisión de
 * producto — el detalle va solo en el tooltip, no en tabla). El canvas
 * sigue aria-hidden; la leyenda de texto de al lado lleva los conteos para
 * que el número siga siendo accesible sin mouse.
 */
function unidadesPieOptions(
  segments: { name: string; value: number; color: string; codes: string[] }[],
): EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      extraCssText: 'max-width:240px;white-space:normal;',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; data?: { codes?: string[] } };
        const codes = p.data?.codes ?? [];
        const detalle = codes.length
          ? `<br/><span style="opacity:.75">${codes.join(', ')}</span>`
          : '';
        return `<strong>${p.name}</strong>: ${p.value} (${p.percent}%)${detalle}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: false },
        data: segments.map(s => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color },
          codes: s.codes,
        })),
      },
    ],
  };
}

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
    PageHeader,
    KpiStat,
    DynadrillSpinnerComponent,
    DynadrillTextComponent,
    DynadrillChartComponent,
    DynadrillDataTableComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
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

  // ── Filtro por rango de fechas (sobre la fecha de creación de la orden) ──

  protected readonly fechaDesde = signal<Date | null>(null);
  protected readonly fechaHasta = signal<Date | null>(null);

  protected readonly hayFiltros = computed(() => !!this.filtroTipo() || !!this.fechaDesde() || !!this.fechaHasta());

  protected setFechaDesde(fecha: Date | null): void {
    this.fechaDesde.set(fecha ?? null);
  }

  protected setFechaHasta(fecha: Date | null): void {
    this.fechaHasta.set(fecha ?? null);
  }

  /** Impide elegir un "Desde" posterior al "Hasta" y viceversa. */
  protected readonly desdeNoPermitido = (fecha: Date): boolean => {
    const hasta = this.fechaHasta();
    return !!hasta && fecha.getTime() > hasta.getTime();
  };

  protected readonly hastaNoPermitido = (fecha: Date): boolean => {
    const desde = this.fechaDesde();
    return !!desde && fecha.getTime() < new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime();
  };

  protected limpiarFiltros(): void {
    this.filtroTipo.set(null);
    this.fechaDesde.set(null);
    this.fechaHasta.set(null);
  }

  /** Órdenes dentro del rango de fechas (ambos extremos inclusive), sin filtrar por tipo de unidad. */
  protected readonly ordersEnRango = computed(() => {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (!desde && !hasta) return this.orders();
    const inicio = desde ? new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime() : -Infinity;
    const fin = hasta ? new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + 1).getTime() : Infinity;
    return this.orders().filter(o => {
      const t = new Date(o.createdAt).getTime();
      return t >= inicio && t < fin;
    });
  });

  protected readonly filteredOrders = computed(() => {
    const tipo = this.filtroTipo();
    if (!tipo) return this.ordersEnRango();
    const codes = new Set(this.filteredUnidades().map(u => u.code));
    return this.ordersEnRango().filter(o => codes.has(o.unidad));
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

  protected readonly alertasGeneradas = computed(() => this.alertas().length);

  // ── Clasificación por unidad para los pasteles (respeta el filtro "Tipo de unidad") ──
  // Dos sectores por indicador: sano vs. en alerta. El desglose fino de qué
  // unidades caen en cada grupo va en el tooltip del pastel, no acá.

  /** Una unidad "cumple" el plan si ninguna de sus alertas preventivas está vencida (roja). Sin alertas aplicables ⇒ cumple. */
  private cumpleElPlan(u: Unidad): boolean {
    return !calcularAlertas(u).some(a => a.nivel === 'rojo');
  }

  protected readonly cumplimientoPorUnidad = computed(() => {
    const unidades = this.filteredUnidades();
    return {
      cumplen: unidades.filter(u => this.cumpleElPlan(u)),
      noCumplen: unidades.filter(u => !this.cumpleElPlan(u)),
    };
  });

  protected readonly disponibilidadPorUnidad = computed(() => {
    const conOrdenAbierta = new Set(
      this.filteredOrders().filter(o => !o.returnedToOperation).map(o => o.unidad),
    );
    const unidades = this.filteredUnidades();
    return {
      disponibles: unidades.filter(u => !conOrdenAbierta.has(u.code)),
      noDisponibles: unidades.filter(u => conOrdenAbierta.has(u.code)),
    };
  });

  protected readonly cumplimientoPieOptions = computed<EChartsCoreOption>(() => {
    const { cumplen, noCumplen } = this.cumplimientoPorUnidad();
    return unidadesPieOptions([
      { name: 'Cumplen', value: cumplen.length, color: ESTADO_HEX.ok, codes: cumplen.map(u => u.code) },
      { name: 'No cumplen', value: noCumplen.length, color: ESTADO_HEX.alerta, codes: noCumplen.map(u => u.code) },
    ]);
  });

  protected readonly cumplimientoPieLegend = computed(() => {
    const { cumplen, noCumplen } = this.cumplimientoPorUnidad();
    return conPorcentaje([
      { text: 'Cumplen', value: cumplen.length, color: ESTADO_HEX.ok },
      { text: 'No cumplen', value: noCumplen.length, color: ESTADO_HEX.alerta },
    ]);
  });

  protected readonly disponibilidadPieOptions = computed<EChartsCoreOption>(() => {
    const { disponibles, noDisponibles } = this.disponibilidadPorUnidad();
    return unidadesPieOptions([
      { name: 'Disponibles', value: disponibles.length, color: ESTADO_HEX.ok, codes: disponibles.map(u => u.code) },
      { name: 'No disponibles', value: noDisponibles.length, color: ESTADO_HEX.alerta, codes: noDisponibles.map(u => u.code) },
    ]);
  });

  protected readonly disponibilidadPieLegend = computed(() => {
    const { disponibles, noDisponibles } = this.disponibilidadPorUnidad();
    return conPorcentaje([
      { text: 'Disponibles', value: disponibles.length, color: ESTADO_HEX.ok },
      { text: 'No disponibles', value: noDisponibles.length, color: ESTADO_HEX.alerta },
    ]);
  });

  protected readonly hayUnidades = computed(() => this.filteredUnidades().length > 0);

  // ── KPI row + charts ──

  /** Tarjetas de color (Figma "D · Indicadores de Mantenimiento"): MTTR en lila, MTBF en verde y alertas en ámbar. */
  protected readonly kpis = computed<{ label: string; value: string | number; tone: KpiStatTone }[]>(() => [
    { label: 'Generación de orden (prom.)', value: `${this.tiempoGeneracionOrden().toFixed(1)} h`, tone: 'neutral' },
    { label: 'Diagnóstico (prom.)', value: `${this.tiempoDiagnostico().toFixed(1)} h`, tone: 'neutral' },
    { label: 'Reparación (prom.)', value: `${this.tiempoReparacion().toFixed(1)} h`, tone: 'neutral' },
    { label: 'MTTR', value: `${this.mttrHoras().toFixed(1)} h`, tone: 'brand' },
    { label: 'MTBF', value: `${this.mtbfDias().toFixed(1)} d`, tone: 'success' },
    { label: 'Alertas preventivas generadas', value: this.alertasGeneradas(), tone: 'warning' },
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
    for (const o of this.ordersEnRango()) {
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
