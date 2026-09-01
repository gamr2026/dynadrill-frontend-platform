import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
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

/**
 * FACT-005 — Reportería y Control de Gestión. No hay reportes automáticos
 * (email semanal/mensual, SMS) todavía — es un dashboard en vivo con los
 * mismos datos que consumirían esos reportes, calculado sobre los
 * registros actuales del interceptor de mocks.
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
    { key: 'pedidoId', header: 'Pedido' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'netoCobrar', header: 'Neto a cobrar' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  /** Ticket activos = OTQ sin Ticket de Facturación generado todavía (pedido en ejecución). */
  protected readonly ticketsActivosRows = computed(() => {
    const docs = this.documentacion();
    const cerradosPedidoIds = new Set(this.tickets().map(t => t.pedidoId));
    return this.otqs()
      .filter(otq => !cerradosPedidoIds.has(otq.pedidoId))
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
        };
      });
  });

  protected readonly ticketsRows = computed(() =>
    this.tickets().map(t => ({
      id: t.id,
      code: t.code,
      pedidoId: t.pedidoId,
      subtotal: '$' + t.subtotal.toFixed(2),
      netoCobrar: '$' + t.netoCobrar.toFixed(2),
      estadoBadge: t.estado === 'facturado' ? { text: 'Facturado', tone: 'success' as const } : { text: 'Cerrado', tone: 'warning' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly activeTab = signal(0);

  protected readonly tabs = computed<DynadrillTab[]>(() => [
    { label: 'Tickets activos', badge: this.ticketsActivosRows().length },
    { label: 'Cerrados y facturados', badge: this.tickets().length },
  ]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const tickets = this.tickets();
    const facturacionAcumulada = tickets.reduce((sum, t) => sum + t.subtotal, 0);
    return [
      { label: 'Facturación acumulada', value: '$' + facturacionAcumulada.toFixed(2), tone: 'brand' },
      { label: 'Tickets activos (en ejecución)', value: this.ticketsActivosRows().length, tone: 'neutral' },
      { label: 'Tickets cerrados', value: tickets.filter(t => t.estado === 'cerrado').length, tone: 'warning' },
      { label: 'Tickets facturados', value: tickets.filter(t => t.estado === 'facturado').length, tone: 'success' },
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
}
