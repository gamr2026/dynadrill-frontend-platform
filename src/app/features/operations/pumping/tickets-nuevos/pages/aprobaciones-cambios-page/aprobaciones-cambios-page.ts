import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { TicketCambioItemsRevisarDialog, type TicketCambioItemsRevisarDialogData } from '../../components/ticket-cambio-items-revisar-dialog/ticket-cambio-items-revisar-dialog';
import type { SolicitudCambioItems } from '../../models/cambio-items';
import { mensajeErrorTicket } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

/**
 * Bandeja de Aprobaciones del Supervisor: los cambios de ítems del pedido que el equipo propuso en los tickets que él supervisa
 * (Superadmin ve todos), sin tener que entrar ticket por ticket.
 */
@Component({
  selector: 'app-aprobaciones-cambios-page',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillScreenHeaderComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ap">
      <dynadrill-screen-header eyebrow="PUMPING" title="Aprobaciones" subtitle="Cambios de ítems del pedido que esperan su decisión" />
      <dynadrill-button variant="secondary" (clicked)="volver()">Volver a la bandeja</dynadrill-button>

      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando…">
        <section class="ap__tarjeta" aria-label="Cambios pendientes">
          <table class="ap__tabla">
            <caption class="sr-only">Cambios de ítems pendientes</caption>
            <thead>
              <tr><th scope="col">Ticket</th><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col">Solicitado por</th><th scope="col">Motivo</th><th scope="col"><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              @for (s of solicitudes(); track s.id) {
                <tr>
                  <td>{{ s.ticket?.numero ?? 's/n' }}</td>
                  <td>{{ s.ticket?.pedidoCodigo }}</td>
                  <td>{{ s.ticket?.cliente ?? '—' }}</td>
                  <td>{{ s.solicitadoPor.nombre }}</td>
                  <td>{{ s.motivo }}</td>
                  <td class="ap__acciones"><dynadrill-button variant="primary" size="small" (clicked)="revisar(s)">Revisar</dynadrill-button></td>
                </tr>
              }
            </tbody>
          </table>
          @if (vacio()) {
            <p class="ap__meta">No hay cambios pendientes de aprobación.</p>
          }
        </section>
      </dynadrill-spinner>
    </div>
  `,
  styles: `
    .ap { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
    .ap__tarjeta { background: #fff; border: 1px solid #ecebf1; border-radius: 12px; padding: 16px; }
    .ap__tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ap__tabla th, .ap__tabla td { text-align: left; padding: 8px; border-bottom: 1px solid #ecebf1; }
    .ap__tabla th { font-weight: 600; color: #5c5870; }
    .ap__acciones { text-align: right; }
    .ap__meta { color: #5c5870; font-size: 13px; }
  `,
})
export class AprobacionesCambiosPage {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly solicitudes = signal<SolicitudCambioItems[]>([]);
  protected readonly vacio = computed(() => !this.cargando() && !this.error() && this.solicitudes().length === 0);

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.cambiosItemsPendientes().subscribe({
      next: l => {
        this.solicitudes.set(l);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudieron cargar las aprobaciones.'));
      },
    });
  }

  protected revisar(s: SolicitudCambioItems): void {
    if (!s.ticket) return;
    const ref = this.dialog.open<TicketCambioItemsRevisarDialog, TicketCambioItemsRevisarDialogData>({
      title: `Cambio de ítems — pedido ${s.ticket.pedidoCodigo}`,
      content: TicketCambioItemsRevisarDialog,
      data: { solicitud: s, pedidoId: s.ticket.pedidoId, puedeRevisar: true },
      footer: false,
      width: '820px',
    });
    ref.afterClose.subscribe((r: SolicitudCambioItems | undefined) => r && this.cargar());
  }

  protected volver(): void {
    void this.router.navigate(['/modulos/operativo/pumping/pedidos']);
  }
}
