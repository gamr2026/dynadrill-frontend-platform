import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { FacturacionTicket } from '../../models/facturacion.model';
import { FacturacionTicketService } from '../../services/facturacion.service';

@Component({
  selector: 'app-ticket-facturacion-detail-page',
  imports: [DecimalPipe, DynadrillScreenHeaderComponent, DynadrillTagComponent, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillBannerComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-facturacion-detail-page.html',
  styleUrl: './ticket-facturacion-detail-page.scss',
})
export class TicketFacturacionDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(FacturacionTicketService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly ticketId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly ticket = signal<FacturacionTicket | null>(null);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.ticketService.get(this.ticketId).subscribe({
      next: t => {
        this.ticket.set(t);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el Ticket.');
      },
    });
  }

  /**
   * Simulado: hasta que exista la integración de escritura con AS2
   * (Factura Cliente), esto solo cambia el estado local. El día que exista
   * esa API, este es el punto donde se dispararía la emisión real.
   */
  protected marcarFacturado(): void {
    this.ticketService.marcarFacturado(this.ticketId).subscribe({
      next: () => {
        this.notify.success('Marcado como facturado', 'Simulado — todavía no hay integración real con AS2 para emitir la factura.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo actualizar el Ticket.'),
    });
  }
}
