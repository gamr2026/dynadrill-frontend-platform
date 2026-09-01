import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { calcularPrefactura, DocumentacionDiaria, FacturacionTicket, Otq } from '../../models/facturacion.model';
import { DocumentacionDiariaService, FacturacionTicketService, OtqService } from '../../services/facturacion.service';

function presupuestoDe(otq: Otq): number {
  return otq.items.reduce((sum, i) => sum + i.total, 0);
}

function descargarCsv(nombre: string, columnas: { header: string; key: string }[], filas: Record<string, unknown>[]): void {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const encabezado = columnas.map(c => escapar(c.header)).join(',');
  const cuerpo = filas.map(r => columnas.map(c => escapar(r[c.key])).join(','));
  // BOM para que Excel detecte UTF-8 y no rompa tildes/ñ.
  const contenido = '﻿' + [encabezado, ...cuerpo].join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * FACT-005 — Reportería y Control de Gestión. No hay reportes automáticos
 * (email semanal/mensual, SMS) todavía — es un dashboard en vivo con los
 * mismos datos que consumirían esos reportes, calculado sobre los
 * registros actuales del interceptor de mocks. La "Exportación a Excel"
 * del documento se resuelve con CSV (compatible con Excel, sin agregar una
 * librería nueva al bundle) hasta que se necesite un formato .xlsx real.
 */
@Component({
  selector: 'app-reporteria-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillSpinnerComponent,
    DynadrillTabsComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporteria-page.html',
  styleUrl: './reporteria-page.scss',
})
export class ReporteriaPage {
  private readonly otqService = inject(OtqService);
  private readonly docService = inject(DocumentacionDiariaService);
  private readonly ticketService = inject(FacturacionTicketService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly otqs = signal<Otq[]>([]);
  protected readonly documentacion = signal<DocumentacionDiaria[]>([]);
  protected readonly tickets = signal<FacturacionTicket[]>([]);

  // ── Filtros — aplican sobre ambas pestañas ──
  protected readonly filtroCliente = signal('');
  protected readonly filtroFechaDesde = signal<Date | null>(null);
  protected readonly filtroFechaHasta = signal<Date | null>(null);

  protected readonly hayFiltrosActivos = computed(() => !!this.filtroCliente().trim() || !!this.filtroFechaDesde() || !!this.filtroFechaHasta());

  protected limpiarFiltros(): void {
    this.filtroCliente.set('');
    this.filtroFechaDesde.set(null);
    this.filtroFechaHasta.set(null);
  }

  protected readonly activosColumns: DynadrillDataTableColumn[] = [
    { key: 'numero', header: 'OTQ', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'ubicacion', header: 'Campo / Pozo', searchable: true },
    { key: 'presupuesto', header: 'Presupuesto' },
    { key: 'acumulado', header: 'Ejecutado' },
    { key: 'semaforoBadge', header: '% Ejecutado', type: 'badge' },
  ];

  protected readonly ticketsColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'pedidoId', header: 'Pedido' },
    { key: 'fechaCierre', header: 'Fecha de cierre', sortable: true },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'netoCobrar', header: 'Neto a cobrar' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private clienteDePedido(pedidoId: number): string {
    return this.otqs().find(o => o.pedidoId === pedidoId)?.cliente ?? '';
  }

  /** Ticket activos = OTQ sin Ticket de Facturación generado todavía (pedido en ejecución). */
  protected readonly ticketsActivosRows = computed(() => {
    const docs = this.documentacion();
    const cerradosPedidoIds = new Set(this.tickets().map(t => t.pedidoId));
    const filtroCliente = this.filtroCliente().trim().toLowerCase();

    return this.otqs()
      .filter(otq => !cerradosPedidoIds.has(otq.pedidoId))
      .filter(otq => !filtroCliente || otq.cliente.toLowerCase().includes(filtroCliente))
      .map(otq => {
        const pre = calcularPrefactura(otq.pedidoId, presupuestoDe(otq), docs, otq.items);
        const tono: 'success' | 'warning' | 'error' = pre.porcentajeConsumido >= 100 ? 'error' : pre.porcentajeConsumido >= 85 ? 'warning' : 'success';
        return {
          id: otq.id,
          pedidoId: otq.pedidoId,
          numero: otq.numero,
          cliente: otq.cliente,
          ubicacion: `${otq.campo} — ${otq.pozo}`,
          presupuesto: '$' + presupuestoDe(otq).toFixed(2),
          acumulado: '$' + pre.acumulado.toFixed(2),
          semaforoBadge: { text: pre.porcentajeConsumido + '%', tone: tono },
          _porcentaje: pre.porcentajeConsumido,
        };
      });
  });

  protected readonly ticketsRows = computed(() => {
    const filtroCliente = this.filtroCliente().trim().toLowerCase();
    const desde = this.filtroFechaDesde();
    const hasta = this.filtroFechaHasta();

    return this.tickets()
      .filter(t => {
        const cliente = this.clienteDePedido(t.pedidoId).toLowerCase();
        if (filtroCliente && !cliente.includes(filtroCliente)) return false;
        const fecha = new Date(t.fechaCierre);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        return true;
      })
      .map(t => ({
        id: t.id,
        code: t.code,
        cliente: this.clienteDePedido(t.pedidoId),
        pedidoId: t.pedidoId,
        fechaCierre: new Date(t.fechaCierre).toLocaleDateString('es-EC'),
        subtotal: '$' + t.subtotal.toFixed(2),
        netoCobrar: '$' + t.netoCobrar.toFixed(2),
        estadoBadge: t.estado === 'facturado' ? { text: 'Facturado', tone: 'success' as const } : { text: 'Cerrado', tone: 'warning' as const },
      }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly activeTab = signal(0);

  protected readonly tabs = computed<DynadrillTab[]>(() => [
    { label: 'Tickets activos', badge: this.ticketsActivosRows().length },
    { label: 'Cerrados y facturados', badge: this.ticketsRows().length },
  ]);

  /** Indicadores operativos (FACT-005) — derivados de los datos ya cargados, sin llamadas extra. */
  protected readonly tasaSobrepaso = computed(() => {
    const activos = this.ticketsActivosRows();
    if (!activos.length) return 0;
    const sobrepasados = activos.filter(r => r._porcentaje >= 100).length;
    return Math.round((sobrepasados / activos.length) * 100);
  });

  protected readonly tiempoPromedioCierre = computed(() => {
    const cerrados = this.tickets();
    if (!cerrados.length) return null;
    const dias = cerrados
      .map(t => {
        const otq = this.otqs().find(o => o.id === t.otqId);
        if (!otq) return null;
        const ms = new Date(t.fechaCierre).getTime() - new Date(otq.createdAt).getTime();
        return ms > 0 ? ms / (1000 * 60 * 60 * 24) : null;
      })
      .filter((d): d is number => d !== null);
    if (!dias.length) return null;
    return Math.round((dias.reduce((s, d) => s + d, 0) / dias.length) * 10) / 10;
  });

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const tickets = this.tickets();
    const facturacionAcumulada = tickets.reduce((sum, t) => sum + t.subtotal, 0);
    const tiempoCierre = this.tiempoPromedioCierre();
    return [
      { label: 'Facturación acumulada', value: '$' + facturacionAcumulada.toFixed(2), tone: 'brand' },
      { label: 'Tickets activos (en ejecución)', value: this.ticketsActivosRows().length, tone: 'neutral' },
      { label: 'Tickets facturados', value: tickets.filter(t => t.estado === 'facturado').length, tone: 'success' },
      { label: 'Tasa de sobrepaso (activos)', value: this.tasaSobrepaso() + '%', tone: this.tasaSobrepaso() > 10 ? 'error' : 'neutral' },
      { label: 'Tiempo prom. de cierre', value: tiempoCierre !== null ? tiempoCierre + ' d' : '—', tone: 'neutral' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ otqs: this.otqService.list(), documentacion: this.docService.list(), tickets: this.ticketService.list() }).subscribe({
      next: ({ otqs, documentacion, tickets }) => {
        this.otqs.set(otqs);
        this.documentacion.set(documentacion);
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la reportería.');
      },
    });
  }

  protected verPedido(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/pedidos', row['pedidoId']]);
  }

  protected verTicket(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/tickets', row['id']]);
  }

  protected exportarActivos(): void {
    descargarCsv(
      `tickets-activos-${new Date().toISOString().slice(0, 10)}.csv`,
      this.activosColumns.filter(c => c.key !== 'semaforoBadge').concat([{ key: 'semaforoBadge', header: '% Ejecutado' } as DynadrillDataTableColumn]),
      this.ticketsActivosRows().map(r => ({ ...r, semaforoBadge: r.semaforoBadge.text })),
    );
    this.notify.success('Exportado', 'Se descargó el CSV de tickets activos.');
  }

  protected exportarCerrados(): void {
    descargarCsv(
      `tickets-cerrados-facturados-${new Date().toISOString().slice(0, 10)}.csv`,
      this.ticketsColumns.filter(c => c.key !== 'estadoBadge').concat([{ key: 'estadoBadge', header: 'Estado' } as DynadrillDataTableColumn]),
      this.ticketsRows().map(r => ({ ...r, estadoBadge: r.estadoBadge.text })),
    );
    this.notify.success('Exportado', 'Se descargó el CSV de tickets cerrados y facturados.');
  }
}
