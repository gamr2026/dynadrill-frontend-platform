import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillCardComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillButtonComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { FacturacionTicket } from '../../models/facturacion.model';
import { FacturacionTicketService } from '../../services/facturacion.service';

@Component({
  selector: 'app-ticket-facturacion-list-page',
  imports: [
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
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

  protected verDetalle(id: number): void {
    this.router.navigate(['/dashboard/facturacion/tickets', id]);
  }
}
