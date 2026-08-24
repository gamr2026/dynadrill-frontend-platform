import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillChartComponent,
  DynadrillChartSeries,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { Unidad, calcularAlertas } from '../models/unidad.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { UnidadesService } from '../services/unidades.service';

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

  protected readonly loading = signal(true);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);
  protected readonly unidades = signal<Unidad[]>([]);

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
    const horas = this.orders()
      .map(o => {
        const report = this.unitReports().find(r => r.id === o.unitReportId);
        return report ? hoursBetween(report.createdAt, o.createdAt) : null;
      })
      .filter((h): h is number => h !== null && h >= 0);
    return average(horas);
  });

  protected readonly tiempoDiagnostico = computed(() => {
    const horas = this.orders().flatMap(o =>
      o.subOrders
        .filter(s => s.ejecucionIniciadaEn)
        .map(s => hoursBetween(o.createdAt, s.ejecucionIniciadaEn!)),
    ).filter(h => h >= 0);
    return average(horas);
  });

  protected readonly tiempoReparacion = computed(() => {
    const horas = this.orders().flatMap(o =>
      o.subOrders
        .filter(s => s.ejecucionIniciadaEn && s.ejecucionTerminadaEn)
        .map(s => hoursBetween(s.ejecucionIniciadaEn!, s.ejecucionTerminadaEn!)),
    ).filter(h => h >= 0);
    return average(horas);
  });

  // ── De flota / confiabilidad ──

  protected readonly mttrHoras = computed(() => {
    const horas = this.orders()
      .filter(o => o.closedAt)
      .map(o => hoursBetween(o.createdAt, o.closedAt!));
    return average(horas);
  });

  /** MTBF aproximado: promedio de días entre creación de órdenes consecutivas, por unidad. */
  protected readonly mtbfDias = computed(() => {
    const porUnidad = new Map<string, string[]>();
    for (const o of this.orders()) {
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
    const total = this.unidades().length;
    if (!total) return 0;
    const conOrdenAbierta = new Set(this.orders().filter(o => !o.returnedToOperation).map(o => o.unidad));
    const disponibles = this.unidades().filter(u => !conOrdenAbierta.has(u.code)).length;
    return Math.round((disponibles / total) * 100);
  });

  protected readonly fallasRepetitivas = computed(() => {
    const porUnidad = new Map<string, number>();
    for (const o of this.orders()) {
      porUnidad.set(o.unidad, (porUnidad.get(o.unidad) ?? 0) + 1);
    }
    return [...porUnidad.entries()]
      .map(([unidad, cantidad]) => ({ unidad, cantidad }))
      .filter(r => r.cantidad > 1)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);
  });

  // ── De cumplimiento preventivo ──

  protected readonly alertas = computed(() => this.unidades().flatMap(u => calcularAlertas(u)));

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
}
