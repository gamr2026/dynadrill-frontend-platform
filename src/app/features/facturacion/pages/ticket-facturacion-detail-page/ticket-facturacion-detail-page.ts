import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillKpiCardComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ActaEntregaRecepcion, FacturacionTicket, Otq } from '../../models/facturacion.model';
import { ActaEntregaService, FacturacionTicketService, OtqService } from '../../services/facturacion.service';
import { TicketPdfDialog, TicketPdfDialogData } from '../../components/ticket-pdf-dialog';

@Component({
  selector: 'app-ticket-facturacion-detail-page',
  imports: [
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillKpiCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-facturacion-detail-page.html',
  styleUrl: './ticket-facturacion-detail-page.scss',
})
export class TicketFacturacionDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(FacturacionTicketService);
  private readonly otqService = inject(OtqService);
  private readonly actaService = inject(ActaEntregaService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly ticketId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly ticket = signal<FacturacionTicket | null>(null);
  private readonly otq = signal<Otq | null>(null);
  private readonly acta = signal<ActaEntregaRecepcion | null>(null);

  protected readonly netoCobrarFormateado = computed(() => {
    const t = this.ticket();
    return t ? '$' + t.netoCobrar.toFixed(2) : '';
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.ticketService.get(this.ticketId).subscribe({
      next: t => {
        this.ticket.set(t);
        forkJoin({ otqs: this.otqService.list(), actas: this.actaService.list() }).subscribe(({ otqs, actas }) => {
          this.otq.set(otqs.find(o => o.id === t.otqId) ?? null);
          this.acta.set(actas.find(a => a.pedidoId === t.pedidoId) ?? null);
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el Ticket.');
      },
    });
  }

  /** Vista imprimible de la Prefactura (formato DYN-AFN-RE-11B). */
  protected verPdf(): void {
    const t = this.ticket();
    if (!t) return;
    this.dialog.open<TicketPdfDialog, TicketPdfDialogData>({
      title: 'Prefactura — Vista de impresión',
      content: TicketPdfDialog,
      data: { ticket: t, otq: this.otq() ?? undefined, acta: this.acta() ?? undefined },
      footer: false,
      width: '860px',
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
