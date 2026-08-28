import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { FacturacionTicket } from '../../models/facturacion.model';
import { FacturacionTicketService } from '../../services/facturacion.service';

@Component({
  selector: 'app-ticket-facturacion-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent, DynadrillButtonComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-facturacion-list-page.html',
  styleUrl: './ticket-facturacion-list-page.scss',
})
export class TicketFacturacionListPage {
  private readonly ticketService = inject(FacturacionTicketService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly tickets = signal<FacturacionTicket[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'servicios', header: 'Servicios' },
    { key: 'materiales', header: 'Materiales' },
    { key: 'subtotal', header: 'Subtotal' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.tickets().map(t => ({
      id: t.id,
      code: t.code,
      servicios: '$' + t.subtotalServicios.toFixed(2),
      materiales: '$' + t.subtotalMateriales.toFixed(2),
      subtotal: '$' + t.subtotal.toFixed(2),
      estadoBadge: t.estado === 'facturado' ? { text: 'Facturado', tone: 'success' as const } : { text: 'Cerrado', tone: 'warning' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.tickets();
    return [
      { label: 'Total Tickets', value: all.length, tone: 'neutral' },
      { label: 'Cerrados (por facturar)', value: all.filter(t => t.estado === 'cerrado').length, tone: 'warning' },
      { label: 'Facturados', value: all.filter(t => t.estado === 'facturado').length, tone: 'success' },
      { label: 'Monto total', value: '$' + all.reduce((sum, t) => sum + t.subtotal, 0).toFixed(2), tone: 'brand' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.ticketService.list().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de Tickets.');
      },
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/tickets', row['id']]);
  }
}
