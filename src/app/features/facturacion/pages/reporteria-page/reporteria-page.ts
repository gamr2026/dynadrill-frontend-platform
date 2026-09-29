import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillChartComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  type DynadrillChartSeries,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { ESTADO_PEDIDO_LABELS, TIPO_SERVICIO_LABELS, EstadoPedido, Pedido, TIPO_OT_LABELS, TipoOt, itemsEstimadosDe, tiposServicioLabel, valorEstimadoPedido } from '../../models/pedido.model';
import { Prefactura } from '../../models/prefactura.model';
import { GuiaRemision } from '../../models/guia-remision.model';
import { Aot } from '../../models/aot.model';
import { AotService, GuiaRemisionService, PedidoService, PrefacturaService } from '../../services/pedido.service';
import { ReporteriaFiltros, ReporteriaFiltrosDialog } from '../../components/reporteria-filtros-dialog';
import { ListPager } from '../../../../shared/components/list-pager/list-pager';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { createPagination } from '../../../../shared/utils/pagination.util';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';

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

/** Opciones del filtro (ícono de embudo de nz-table) de una columna — valores realmente presentes en `rows`, no un enum fijo. */
function uniqueFilters(rows: Record<string, unknown>[], key: string): { text: string; value: string }[] {
  const valores = new Set(rows.map(r => String(r[key] ?? '')).filter(Boolean));
  return [...valores].sort((a, b) => a.localeCompare(b)).map(v => ({ text: v, value: v }));
}

/** FACT-005 — Reportería y control de gestión. */
@Component({
  selector: 'app-reporteria-page',
  imports: [
    DecimalPipe,
    ListPager,
    SearchField,
    DynadrillScreenHeaderComponent,
    KpiStat,
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
  private readonly aotService = inject(AotService);
  private readonly guiaService = inject(GuiaRemisionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map(state => state.matches)),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly prefacturas = signal<Prefactura[]>([]);
  protected readonly aots = signal<Aot[]>([]);
  protected readonly guias = signal<GuiaRemision[]>([]);
  /** Pestaña activa, en el orden en que se muestran (`tabs`); Secuencial TK es la primera. */
  protected readonly activeTab = signal(0);
  /**
   * `?estado=<EstadoPedido>` en la URL — acceso directo desde la card de
   * Facturación del dashboard ("Enviados para firmar", etc.): al entrar acá
   * ya con un estado, la vista abre en "Secuencial TK" filtrada, sin que la
   * clienta tenga que buscar/filtrar a mano.
   */
  protected readonly estadoFiltro = signal<EstadoPedido | null>(null);
  protected readonly estadoFiltroLabel = computed(() => {
    const e = this.estadoFiltro();
    return e ? ESTADO_PEDIDO_LABELS[e] : null;
  });

  private readonly tabsBase: DynadrillTab[] = [
    { label: 'Por mes' },
    { label: 'Por pozo y tipo de servicio' },
    { label: 'Estado por cliente' },
    { label: 'Cotizado vs. real' },
    { label: 'Control de tickets' },
    { label: 'Servicio vs. Venta' },
    { label: 'Secuencial TK' },
  ];
  /**
   * Orden de presentación (Figma): Secuencial TK primero. Cada valor es el
   * índice "lógico" de `tabsBase` — el que usan los `@case` del template y
   * `exportar()` — para no renumerar todo el contenido.
   */
  protected readonly tabOrder = [6, 0, 1, 2, 3, 4, 5];
  protected readonly tabs: DynadrillTab[] = this.tabOrder.map(i => this.tabsBase[i]);

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
  /** Meses del más reciente al más antiguo (lista móvil de Figma); el gráfico sigue en orden cronológico. */
  protected readonly porMesDesc = computed(() => [...this.porMesRows()].reverse());

  /** "2026-09" → "Septiembre 2026". */
  protected mesLabel(mes: string): string {
    const [y, m] = mes.split('-').map(Number);
    const texto = new Date(y, m - 1, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  protected readonly porMesColumns: DynadrillDataTableColumn[] = [
    { key: 'mes', header: 'Mes', sortable: true },
    { key: 'revenue', header: 'Revenue real' },
    { key: 'jobs', header: 'Nº de trabajos' },
  ];
  protected readonly porMesChartCategories = computed(() => this.porMesRows().map(r => r.mes));
  protected readonly porMesChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Revenue real', data: this.porMesRows().map(r => r._r) },
  ]);

  // ── 2. Ingresos por pozo y tipo de servicio ──
  protected readonly porPozoRows = computed(() =>
    this.prefacturas()
      .filter(p => p.estado === 'firmada')
      .map(pf => {
        const p = this.pedidoDe(pf.pedidoId);
        return {
          id: pf.id,
          pozo: p?.pozo ?? '—',
          linea: p ? tiposServicioLabel(p.tipoServicio) : '—',
          cliente: p?.cliente ?? '—',
          revenue: '$' + pf.subtotal.toFixed(2),
        };
      }),
  );
  protected readonly porPozoColumns: DynadrillDataTableColumn[] = [
    { key: 'pozo', header: 'Pozo', sortable: true, searchable: true },
    { key: 'linea', header: 'Tipo de servicio', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'revenue', header: 'Revenue real' },
  ];
  /**
   * Ingresos agregados por tipo de servicio (segundo select del Pedido) —
   * mismo corte que "ventas por sublínea" del VENTAS_DYNADRILL, ahora con
   * el catálogo real de 17 categorías. Un pedido puede tener más de un
   * tipo de servicio: su revenue se suma en el bucket de CADA tipo que
   * tenga, así que el total del gráfico puede superar el ingreso real
   * cuando hay pedidos multi-tipo (es el comportamiento esperado de un
   * breakdown por etiqueta múltiple, no un bug).
   */
  protected readonly porLineaChartData = computed(() => {
    const acc = new Map<string, number>();
    for (const pf of this.prefacturas().filter(p => p.estado === 'firmada')) {
      const p = this.pedidoDe(pf.pedidoId);
      // Array.isArray (no solo `?.length`): un pedido legado con tipoServicio
      // sin migrar a array (string plano) también tiene `.length` truthy pero
      // no `.map` — ver tiposServicioLabel() en pedido.model.ts.
      const tipos = Array.isArray(p?.tipoServicio) && p.tipoServicio.length
        ? p.tipoServicio.map(t => TIPO_SERVICIO_LABELS[t])
        : ['Sin línea'];
      for (const linea of tipos) acc.set(linea, (acc.get(linea) ?? 0) + pf.subtotal);
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
        linea: tiposServicioLabel(p.tipoServicio),
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
    { key: 'linea', header: 'Tipo de servicio', searchable: true },
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
  /** `tipoOt` se pide siempre, para FCR y para Pumping — ver comentario en pedido.model.ts — así que este corte cubre todos los pedidos. */
  protected readonly servicioVentaRows = computed(() => {
    const acc = new Map<TipoOt, { pedidos: number; facturados: number; cotizado: number; real: number }>();
    for (const p of this.pedidos()) {
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

  // ── 7. Secuencial TK — vista consolidada estilo "Secuencial Tk Control" ──
  /**
   * Todos los campos que la clienta de Facturación maneja hoy en el Excel
   * "Secuencial Tk Control", en una sola tabla filtrable por columna (en vez
   * de repartirlos en pestañas separadas) — pidió explícitamente no tener
   * que ir pestaña por pestaña. `Estado`/`Estado TKT` reemplazan a las tres
   * columnas de estado del Excel (Estado Servicio/TKT/OT): `EstadoPedido` ya
   * se diseñó alineado a esas tres (ver comentario en pedido.model.ts), así
   * que exponerlas por separado sería redundante.
   */
  protected readonly tkRows = computed(() => {
    const aotByPedido = new Map(this.aots().map(a => [a.pedidoId, a]));
    const guiaByPedido = new Map(this.guias().map(g => [g.pedidoId, g]));
    return this.pedidos().map(p => {
      const pf = this.prefacturas().find(x => x.pedidoId === p.id);
      const aot = aotByPedido.get(p.id);
      const guia = guiaByPedido.get(p.id);
      const recibeTkt = this.hito(p, 'documentos_completos');
      const entregaFirmas = this.hito(p, 'enviado_para_firmas');
      // Mismas fórmulas del Excel: DIAS PREFAC = Entrega para firmas − Recibe tkt; DIAS SUPERV = Recibe tkt − Fecha Fin.
      const dPref = dias(recibeTkt, entregaFirmas);
      const dSuperv = dias(p.fechaFinServicio, recibeTkt);
      const primerItem = itemsEstimadosDe(p)[0];
      return {
        id: p.id,
        code: p.code,
        ot: aot ? String(aot.numeroOt) : '—',
        cliente: p.cliente,
        mes: p.fechaInicioServicio ? p.fechaInicioServicio.slice(0, 7) : '—',
        linea: tiposServicioLabel(p.tipoServicio),
        campo: p.campo,
        pozo: p.pozo,
        bloque: p.bloque,
        rig: p.taladroRig,
        fechaInicio: p.fechaInicioServicio || '—',
        fechaFin: p.fechaFinServicio || '—',
        descripcion: primerItem?.descripcion ?? '—',
        analista: p.analistaFacturacion ?? '— Sin asignar —',
        vendedor: p.agenteComercial,
        companyMan: p.representanteCampo || '— Sin asignar —',
        representanteQuito: p.representanteQuito || '— Sin asignar —',
        estadoRaw: p.estado,
        estado: ESTADO_PEDIDO_LABELS[p.estado],
        estadoTkt: pf ? pf.estado.replace(/_/g, ' ') : '— Sin generar —',
        guia: guia ? guia.guiaRemisionAs2Ref || 'Elaborada' : 'N/A',
        recibeTkt: recibeTkt ? recibeTkt.slice(0, 10) : '—',
        entregaFirmas: entregaFirmas ? entregaFirmas.slice(0, 10) : '—',
        diasPrefBadge: { text: dPref === null ? '—' : dPref + ' d', tone: semaforo(dPref) },
        diasSupervBadge: { text: dSuperv === null ? '—' : dSuperv + ' d', tone: semaforo(dSuperv) },
      };
    });
  });
  /**
   * Columnas + filtros dinámicos (ícono de embudo de nz-table, ver
   * `dynadrill-data-table.component.ts`) armados sobre los valores que
   * realmente existen en `tkRows` — es lo que pidió la clienta: poder
   * filtrar por Cliente/Línea/Company Man/Estado, etc., no solo buscar.
   */
  protected readonly tkColumns = computed<DynadrillDataTableColumn[]>(() => {
    const rows = this.tkRows();
    const filtros = (key: string) => uniqueFilters(rows, key);
    return [
      { key: 'code', header: 'Ticket', sortable: true, searchable: true, fixed: 'left' },
      { key: 'ot', header: 'OT', sortable: true },
      { key: 'cliente', header: 'Cliente', sortable: true, filters: filtros('cliente') },
      { key: 'mes', header: 'Mes', sortable: true, filters: filtros('mes') },
      { key: 'linea', header: 'Línea Serv.', filters: filtros('linea') },
      { key: 'pozo', header: 'Pozo', searchable: true },
      { key: 'bloque', header: 'Bloque', searchable: true },
      { key: 'rig', header: 'Rig', searchable: true },
      { key: 'fechaInicio', header: 'Fecha Inicio', sortable: true },
      { key: 'fechaFin', header: 'Fecha Fin', sortable: true },
      { key: 'descripcion', header: 'Descripción breve' },
      { key: 'analista', header: 'Analista', filters: filtros('analista') },
      { key: 'vendedor', header: 'Dyna_Ventas', filters: filtros('vendedor') },
      { key: 'companyMan', header: 'Represent. Campo', filters: filtros('companyMan') },
      { key: 'representanteQuito', header: 'Represent. Quito', filters: filtros('representanteQuito') },
      { key: 'estado', header: 'Estado', filters: filtros('estado') },
      { key: 'estadoTkt', header: 'Estado TKT', filters: filtros('estadoTkt') },
      { key: 'guia', header: 'Guía de remisión' },
      { key: 'recibeTkt', header: 'Recibe tkt en Jef Prefact' },
      { key: 'entregaFirmas', header: 'Entrega para firmas a cliente' },
      { key: 'diasPrefBadge', header: 'Días prefact.', type: 'badge' },
      { key: 'diasSupervBadge', header: 'Días superv.', type: 'badge' },
    ];
  });
  /** `tkRows` acotado por el acceso directo del dashboard (`estadoFiltro`) — el ícono de embudo por columna sigue disponible para filtrar más allá de este. */
  protected readonly tkRowsFiltradas = computed(() => {
    const f = this.estadoFiltro();
    const rows = this.tkRows();
    return f ? rows.filter(r => r.estadoRaw === f) : rows;
  });

  // ── Secuencial TK en móvil: tarjetas con búsqueda, filtro por estado y paginación ──
  private static readonly TARJETAS_POR_PAGINA = 10;
  protected readonly tkBusqueda = signal('');

  protected readonly tkCards = computed(() => {
    const q = this.tkBusqueda().trim().toLowerCase();
    const rows = this.tkRowsFiltradas();
    if (!q) return rows;
    return rows.filter(r => [r.code, r.ot, r.cliente, r.campo, r.pozo, r.analista, r.vendedor].some(v => String(v).toLowerCase().includes(q)));
  });
  protected readonly tkPagination = createPagination(this.tkCards, ReporteriaPage.TARJETAS_POR_PAGINA);

  protected onTkBusqueda(valor: string): void {
    this.tkBusqueda.set(valor);
    this.tkPagination.reset();
  }

  protected abrirFiltros(): void {
    const ref = this.dialog.open<ReporteriaFiltrosDialog, ReporteriaFiltros>({
      title: 'Filtros',
      content: ReporteriaFiltrosDialog,
      data: { estado: this.estadoFiltro() },
      size: 'small',
      footer: false,
    });
    ref.afterClose.subscribe((f: ReporteriaFiltros | undefined) => {
      if (!f) return;
      this.estadoFiltro.set(f.estado);
      this.tkPagination.reset();
    });
  }

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<{ value: number | string; label: string; caption: string; tone: KpiStatTone }[]>(() => {
    const firmadas = this.prefacturas().filter(p => p.estado === 'firmada');
    const total = firmadas.reduce((s, p) => s + p.subtotal, 0);
    const enProceso = this.pedidos().filter(p => !['facturado', 'listo_para_facturar', 'enviado_a_control_de_costos', 'anulado'].includes(p.estado));
    const pendientesFirma = this.pendientesFirma().length;
    return [
      { value: '$' + total.toFixed(2), label: 'Revenue real acumulado', caption: 'Prefacturas firmadas', tone: 'brand' },
      { value: firmadas.length, label: 'Trabajos facturados', caption: 'En el período', tone: 'success' },
      { value: enProceso.length, label: 'Pedidos en proceso', caption: 'Sin facturar aún', tone: 'neutral' },
      {
        value: '$' + this.pedidos().filter(p => !this.prefacturas().some(x => x.pedidoId === p.id && x.estado === 'firmada')).reduce((s, p) => s + valorEstimadoPedido(p), 0).toFixed(2),
        label: 'Accrual (por facturar)',
        caption: 'Valor estimado pendiente',
        tone: 'warning',
      },
      { value: pendientesFirma, label: 'Tickets pendientes de firma', caption: 'Esperando al cliente', tone: pendientesFirma > 0 ? 'warning' : 'neutral' },
    ];
  });

  /** Pedidos con prefactura ya enviada al cliente y todavía sin firmar ni rechazar — el "a quién contactar hoy" de Facturación. */
  protected readonly pendientesFirma = computed(() => this.pedidos().filter(p => p.estado === 'enviado_para_firmas'));

  constructor() {
    const estado = this.route.snapshot.queryParamMap.get('estado') as EstadoPedido | null;
    if (estado) {
      this.estadoFiltro.set(estado);
      this.activeTab.set(0);
    }
    this.reload();
  }

  /** Quita el filtro por estado y su rastro en la URL, sin recargar la página (misma pestaña). */
  protected limpiarFiltroEstado(): void {
    this.estadoFiltro.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      pedidos: this.pedidoService.list(),
      prefacturas: this.prefacturaService.list(),
      aots: this.aotService.list(),
      guias: this.guiaService.list(),
    }).subscribe({
      next: ({ pedidos, prefacturas, aots, guias }) => {
        this.pedidos.set(pedidos);
        this.prefacturas.set(prefacturas);
        this.aots.set(aots);
        this.guias.set(guias);
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
    switch (this.tabOrder[this.activeTab()]) {
      case 0:
        return descargarCsv(`ventas-por-mes-${hoy}.csv`, ['Mes', 'Revenue', 'Jobs'], this.porMesRows().map(r => [r.mes, r._r, r._j]));
      case 1:
        return descargarCsv(`ingresos-por-pozo-${hoy}.csv`, ['Pozo', 'Tipo de servicio', 'Cliente', 'Revenue'], this.porPozoRows().map(r => [r.pozo, r.linea, r.cliente, r.revenue]));
      case 2:
        return descargarCsv(`estado-por-cliente-${hoy}.csv`, ['Cliente', 'Estado', 'Nº tickets', 'Accrual'], this.estadoClienteRows().map(r => [r.cliente, r.estado, r.tickets, r._a]));
      case 3:
        return descargarCsv(`cotizado-vs-real-${hoy}.csv`, ['Pedido', 'Cliente', 'Cotizado', 'Real', 'Desviación'], this.cotizadoRealRows().map(r => [r.code, r.cliente, r.cotizado, r.real, r.desviacion]));
      case 4:
        return descargarCsv(
          `control-tickets-${hoy}.csv`,
          ['Ticket', 'Cliente', 'Tipo de servicio', 'Pozo', 'Analista', 'Vendedor', 'Estado', 'Días prefact.', 'Días firma'],
          this.controlRows().map(r => [r.code, r.cliente, r.linea, r.pozo, r.analista, r.vendedor, r.estado, r.diasPrefBadge.text, r.diasFirmaBadge.text]),
        );
      case 5:
        return descargarCsv(
          `servicio-vs-venta-${hoy}.csv`,
          ['Tipo de OT', 'Nº de pedidos', 'Facturados', 'Cotizado', 'Real'],
          this.servicioVentaRows().map(r => [r.tipo, r.pedidos, r.facturados, r.cotizado, r.real]),
        );
      default:
        return descargarCsv(
          `secuencial-tk-${hoy}.csv`,
          [
            'Ticket', 'OT', 'Cliente', 'Mes', 'Línea Serv.', 'Pozo', 'Bloque', 'Rig', 'Fecha Inicio', 'Fecha Fin',
            'Descripción breve', 'Analista', 'Dyna_Ventas', 'Represent. Campo', 'Represent. Quito', 'Estado',
            'Estado TKT', 'Guía de remisión', 'Recibe tkt en Jef Prefact', 'Entrega para firmas a cliente',
            'Días prefact.', 'Días superv.',
          ],
          this.tkRowsFiltradas().map(r => [
            r.code, r.ot, r.cliente, r.mes, r.linea, r.pozo, r.bloque, r.rig, r.fechaInicio, r.fechaFin,
            r.descripcion, r.analista, r.vendedor, r.companyMan, r.representanteQuito, r.estado, r.estadoTkt,
            r.guia, r.recibeTkt, r.entregaFirmas, r.diasPrefBadge.text, r.diasSupervBadge.text,
          ]),
        );
    }
  }
}
