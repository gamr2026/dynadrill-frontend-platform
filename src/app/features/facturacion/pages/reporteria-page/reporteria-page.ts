import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillChartComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  type DynadrillChartSeries,
  type DynadrillKpiRowItem,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { ESTADO_PEDIDO_LABELS, LINEA_SERVICIO_LABELS, Pedido, TIPO_OT_LABELS, TipoOt, valorEstimadoPedido } from '../../models/pedido.model';
import { Prefactura } from '../../models/prefactura.model';
import { PedidoService, PrefacturaService } from '../../services/pedido.service';

function descargarCsv(nombre: string, headers: string[], filas: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const contenido = '﻿' + [headers.map(esc).join(','), ...filas.map(f => f.map(esc).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

/** Días entre dos ISO (o null). */
function dias(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function semaforo(d: number | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (d === null) return 'neutral';
  return d <= 3 ? 'success' : d <= 7 ? 'warning' : 'error';
}

/** FACT-005 — Reportería y control de gestión. */
@Component({
  selector: 'app-reporteria-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
    DynadrillButtonComponent,
    DynadrillChartComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporteria-page.html',
  styleUrl: './reporteria-page.scss',
})
export class ReporteriaPage {
  private readonly pedidoService = inject(PedidoService);
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly prefacturas = signal<Prefactura[]>([]);
  protected readonly activeTab = signal(0);

  protected readonly tabs: DynadrillTab[] = [
    { label: 'Por mes' },
    { label: 'Por pozo y línea' },
    { label: 'Estado por cliente' },
    { label: 'Cotizado vs. real' },
    { label: 'Control de tickets' },
    { label: 'Servicio vs. Venta' },
  ];

  private pedidoDe(id: number): Pedido | undefined {
    return this.pedidos().find(p => p.id === id);
  }

  private hito(p: Pedido, estado: string): string | undefined {
    return p.historialEstados.find(h => h.estado === estado)?.fecha;
  }

  // ── 1. Ventas & nº trabajos por mes ──
  protected readonly porMesRows = computed(() => {
    const acc = new Map<string, { revenue: number; jobs: number }>();
    for (const pf of this.prefacturas().filter(p => p.estado === 'firmada')) {
      const m = mesDe(pf.fechaGeneracion);
      const cur = acc.get(m) ?? { revenue: 0, jobs: 0 };
      cur.revenue += pf.subtotal;
      cur.jobs += 1;
      acc.set(m, cur);
    }
    return [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v], i) => ({ id: mes, mes, revenue: '$' + v.revenue.toFixed(2), jobs: v.jobs, _r: v.revenue, _j: v.jobs, _i: i }));
  });
  protected readonly porMesColumns: DynadrillDataTableColumn[] = [
    { key: 'mes', header: 'Mes', sortable: true },
    { key: 'revenue', header: 'Revenue real' },
    { key: 'jobs', header: 'Nº de trabajos' },
  ];
  protected readonly porMesChartCategories = computed(() => this.porMesRows().map(r => r.mes));
  protected readonly porMesChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Revenue real', data: this.porMesRows().map(r => r._r) },
  ]);

  // ── 2. Ingresos por pozo y línea ──
  protected readonly porPozoRows = computed(() =>
    this.prefacturas()
      .filter(p => p.estado === 'firmada')
      .map(pf => {
        const p = this.pedidoDe(pf.pedidoId);
        return {
          id: pf.id,
          pozo: p?.pozo ?? '—',
          linea: p ? LINEA_SERVICIO_LABELS[p.lineaServicio] : '—',
          cliente: p?.cliente ?? '—',
          revenue: '$' + pf.subtotal.toFixed(2),
        };
      }),
  );
  protected readonly porPozoColumns: DynadrillDataTableColumn[] = [
    { key: 'pozo', header: 'Pozo', sortable: true, searchable: true },
    { key: 'linea', header: 'Línea de servicio', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'revenue', header: 'Revenue real' },
  ];
  /** Ingresos agregados por línea de servicio — mismo corte que "ventas por sublínea" del VENTAS_DYNADRILL. */
  protected readonly porLineaChartData = computed(() => {
    const acc = new Map<string, number>();
    for (const pf of this.prefacturas().filter(p => p.estado === 'firmada')) {
      const p = this.pedidoDe(pf.pedidoId);
      const linea = p ? LINEA_SERVICIO_LABELS[p.lineaServicio] : 'Sin línea';
      acc.set(linea, (acc.get(linea) ?? 0) + pf.subtotal);
    }
    return [...acc.entries()].sort(([a], [b]) => a.localeCompare(b));
  });
  protected readonly porLineaChartCategories = computed(() => this.porLineaChartData().map(([linea]) => linea));
  protected readonly porLineaChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Ingresos reales', data: this.porLineaChartData().map(([, v]) => v) },
  ]);

  // ── 3. Estado de tickets por cliente ──
  protected readonly estadoClienteRows = computed(() => {
    const acc = new Map<string, { tickets: number; accrual: number }>();
    for (const p of this.pedidos()) {
      const key = `${p.cliente}||${ESTADO_PEDIDO_LABELS[p.estado]}`;
      const pf = this.prefacturas().find(x => x.pedidoId === p.id);
      const cur = acc.get(key) ?? { tickets: 0, accrual: 0 };
      cur.tickets += 1;
      cur.accrual += pf?.subtotal ?? valorEstimadoPedido(p);
      acc.set(key, cur);
    }
    return [...acc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [cliente, estado] = key.split('||');
        return { id: key, cliente, estado, tickets: v.tickets, accrual: '$' + v.accrual.toFixed(2), _a: v.accrual };
      });
  });
  protected readonly estadoClienteColumns: DynadrillDataTableColumn[] = [
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'estado', header: 'Estado', sortable: true, searchable: true },
    { key: 'tickets', header: 'Nº tickets' },
    { key: 'accrual', header: 'Accrual (por facturar)' },
  ];
  /** Accrual total por cliente (agregado sobre todos los estados de proceso). */
  protected readonly accrualClienteChartData = computed(() => {
    const acc = new Map<string, number>();
    for (const r of this.estadoClienteRows()) acc.set(r.cliente, (acc.get(r.cliente) ?? 0) + r._a);
    return [...acc.entries()].sort(([, a], [, b]) => b - a);
  });
  protected readonly accrualClienteChartCategories = computed(() => this.accrualClienteChartData().map(([cliente]) => cliente));
  protected readonly accrualClienteChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Accrual', data: this.accrualClienteChartData().map(([, v]) => v) },
  ]);

  // ── 4. Cotizado vs. real ──
  protected readonly cotizadoRealRows = computed(() =>
    this.pedidos().map(p => {
      const pf = this.prefacturas().find(x => x.pedidoId === p.id);
      const cotizado = valorEstimadoPedido(p);
      const real = pf?.subtotal ?? 0;
      const desv = cotizado > 0 ? Math.round(((real - cotizado) / cotizado) * 100) : 0;
      return {
        id: p.id,
        code: p.code,
        cliente: p.cliente,
        cotizado: '$' + cotizado.toFixed(2),
        real: real ? '$' + real.toFixed(2) : '—',
        desviacion: pf ? (desv >= 0 ? '+' : '') + desv + '%' : '—',
      };
    }),
  );
  protected readonly cotizadoRealColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Pedido', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'cotizado', header: 'Cotizado (Ventas)' },
    { key: 'real', header: 'Real (prefactura)' },
    { key: 'desviacion', header: 'Desviación' },
  ];
  private readonly cotizadoRealChartBase = computed(() =>
    this.pedidos().map(p => {
      const pf = this.prefacturas().find(x => x.pedidoId === p.id);
      return { code: p.code, cotizado: valorEstimadoPedido(p), real: pf?.subtotal ?? 0 };
    }),
  );
  protected readonly cotizadoRealChartCategories = computed(() => this.cotizadoRealChartBase().map(r => r.code));
  protected readonly cotizadoRealChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Cotizado (Ventas)', data: this.cotizadoRealChartBase().map(r => r.cotizado) },
    { name: 'Real (prefactura)', data: this.cotizadoRealChartBase().map(r => r.real) },
  ]);

  // ── 5. Control de tickets (estilo Secuencial Tk Control) ──
  protected readonly controlRows = computed(() =>
    this.pedidos().map(p => {
      const dPref = dias(p.fechaFinServicio, this.hito(p, 'documentos_completos'));
      const dFirma = dias(this.hito(p, 'enviado_para_firmas'), this.hito(p, 'ticket_firmado'));
      return {
        id: p.id,
        code: p.code,
        cliente: p.cliente,
        linea: LINEA_SERVICIO_LABELS[p.lineaServicio],
        pozo: p.pozo,
        analista: p.analistaFacturacion ?? '—',
        vendedor: p.agenteComercial,
        estado: ESTADO_PEDIDO_LABELS[p.estado],
        diasPrefBadge: { text: dPref === null ? '—' : dPref + ' d', tone: semaforo(dPref) },
        diasFirmaBadge: { text: dFirma === null ? '—' : dFirma + ' d', tone: semaforo(dFirma) },
      };
    }),
  );
  protected readonly controlColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'linea', header: 'Línea', searchable: true },
    { key: 'pozo', header: 'Pozo', searchable: true },
    { key: 'analista', header: 'Analista' },
    { key: 'vendedor', header: 'Vendedor' },
    { key: 'estado', header: 'Estado' },
    { key: 'diasPrefBadge', header: 'Días prefact.', type: 'badge' },
    { key: 'diasFirmaBadge', header: 'Días firma', type: 'badge' },
  ];
  /** Distribución del semáforo de días de prefacturación — cuántos tickets caen en cada color. */
  protected readonly semaforoChartCategories = ['🟢 Verde (≤3 d)', '🟡 Amarillo (4-7 d)', '🔴 Rojo (>7 d)', '⚪ Sin dato'];
  protected readonly semaforoChartSeries = computed<DynadrillChartSeries[]>(() => {
    const rows = this.controlRows();
    const contar = (tono: string) => rows.filter(r => r.diasPrefBadge.tone === tono).length;
    return [{ name: 'Tickets', data: [contar('success'), contar('warning'), contar('error'), contar('neutral')] }];
  });

  // ── 6. Servicio vs. Venta ──
  /** `tipoOt` solo decide la bifurcación del ticket FCR (ver crearTicketFcrSiAplica) — en Pumping no aplica, se excluye del corte. */
  private readonly pedidosFcr = computed(() => this.pedidos().filter(p => p.lineaServicio !== 'pumping'));
  protected readonly servicioVentaRows = computed(() => {
    const acc = new Map<TipoOt, { pedidos: number; facturados: number; cotizado: number; real: number }>();
    for (const p of this.pedidosFcr()) {
      const pf = this.prefacturas().find(x => x.pedidoId === p.id && x.estado === 'firmada');
      const cur = acc.get(p.tipoOt) ?? { pedidos: 0, facturados: 0, cotizado: 0, real: 0 };
      cur.pedidos += 1;
      cur.cotizado += valorEstimadoPedido(p);
      if (pf) {
        cur.facturados += 1;
        cur.real += pf.subtotal;
      }
      acc.set(p.tipoOt, cur);
    }
    return (['venta', 'servicio'] as TipoOt[])
      .filter(tipo => acc.has(tipo))
      .map(tipo => {
        const v = acc.get(tipo)!;
        return {
          id: tipo,
          tipo: TIPO_OT_LABELS[tipo],
          pedidos: v.pedidos,
          facturados: v.facturados,
          cotizado: '$' + v.cotizado.toFixed(2),
          real: '$' + v.real.toFixed(2),
          _pedidos: v.pedidos,
          _real: v.real,
        };
      });
  });
  protected readonly servicioVentaColumns: DynadrillDataTableColumn[] = [
    { key: 'tipo', header: 'Tipo de OT' },
    { key: 'pedidos', header: 'Nº de pedidos' },
    { key: 'facturados', header: 'Facturados (prefactura firmada)' },
    { key: 'cotizado', header: 'Cotizado (Ventas)' },
    { key: 'real', header: 'Revenue real' },
  ];
  protected readonly servicioVentaChartCategories = computed(() => this.servicioVentaRows().map(r => r.tipo));
  protected readonly servicioVentaChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Nº de pedidos', data: this.servicioVentaRows().map(r => r._pedidos) },
    { name: 'Revenue real', data: this.servicioVentaRows().map(r => r._real) },
  ]);

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const firmadas = this.prefacturas().filter(p => p.estado === 'firmada');
    const total = firmadas.reduce((s, p) => s + p.subtotal, 0);
    const enProceso = this.pedidos().filter(p => !['facturado', 'listo_para_facturar', 'enviado_a_control_de_costos'].includes(p.estado));
    return [
      { label: 'Revenue real acumulado', value: '$' + total.toFixed(2), tone: 'brand' },
      { label: 'Trabajos facturados', value: firmadas.length, tone: 'success' },
      { label: 'Pedidos en proceso', value: enProceso.length, tone: 'neutral' },
      { label: 'Accrual (por facturar)', value: '$' + this.pedidos().filter(p => !this.prefacturas().some(x => x.pedidoId === p.id && x.estado === 'firmada')).reduce((s, p) => s + valorEstimadoPedido(p), 0).toFixed(2), tone: 'warning' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ pedidos: this.pedidoService.list(), prefacturas: this.prefacturaService.list() }).subscribe({
      next: ({ pedidos, prefacturas }) => {
        this.pedidos.set(pedidos);
        this.prefacturas.set(prefacturas);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la reportería.');
      },
    });
  }

  protected exportar(): void {
    const hoy = new Date().toISOString().slice(0, 10);
    switch (this.activeTab()) {
      case 0:
        return descargarCsv(`ventas-por-mes-${hoy}.csv`, ['Mes', 'Revenue', 'Jobs'], this.porMesRows().map(r => [r.mes, r._r, r._j]));
      case 1:
        return descargarCsv(`ingresos-por-pozo-${hoy}.csv`, ['Pozo', 'Línea', 'Cliente', 'Revenue'], this.porPozoRows().map(r => [r.pozo, r.linea, r.cliente, r.revenue]));
      case 2:
        return descargarCsv(`estado-por-cliente-${hoy}.csv`, ['Cliente', 'Estado', 'Nº tickets', 'Accrual'], this.estadoClienteRows().map(r => [r.cliente, r.estado, r.tickets, r._a]));
      case 3:
        return descargarCsv(`cotizado-vs-real-${hoy}.csv`, ['Pedido', 'Cliente', 'Cotizado', 'Real', 'Desviación'], this.cotizadoRealRows().map(r => [r.code, r.cliente, r.cotizado, r.real, r.desviacion]));
      case 4:
        return descargarCsv(
          `control-tickets-${hoy}.csv`,
          ['Ticket', 'Cliente', 'Línea', 'Pozo', 'Analista', 'Vendedor', 'Estado', 'Días prefact.', 'Días firma'],
          this.controlRows().map(r => [r.code, r.cliente, r.linea, r.pozo, r.analista, r.vendedor, r.estado, r.diasPrefBadge.text, r.diasFirmaBadge.text]),
        );
      default:
        return descargarCsv(
          `servicio-vs-venta-${hoy}.csv`,
          ['Tipo de OT', 'Nº de pedidos', 'Facturados', 'Cotizado', 'Real'],
          this.servicioVentaRows().map(r => [r.tipo, r.pedidos, r.facturados, r.cotizado, r.real]),
        );
    }
  }
}
