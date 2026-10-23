import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeErrorTicket, type ObservacionTicket } from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrObservacionesDialogData {
  ticketId: string;
  ticketNumero: number | null;
  /** El ticket está cerrado: las observaciones son de solo lectura. */
  cerrado: boolean;
}

/**
 * Observaciones del ticket (botón «Observaciones»): notas con autor, rol y fecha que se agregan desde cualquier fase, no se editan
 * ni se borran y no disparan ninguna acción de negocio. Mismo diseño que la demo.
 */
@Component({
  selector: 'app-ticket-fcr-observaciones-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../components/observaciones-timeline-dialog.scss',
  template: `
    <section class="fcr-dialog">
      <dynadrill-text variant="caption">Ticket {{ data.ticketNumero ?? 's/n' }}</dynadrill-text>

      @if (observaciones().length > 0) {
        <div class="fcr-dialog__observations">
          @for (o of observaciones(); track o.id) {
            <div class="fcr-dialog__observation">
              <strong>{{ o.autor }} · {{ o.autorRolNombre }}</strong>
              <span class="fcr-dialog__observation-date">{{ fecha(o.fecha) }}</span>
              <p>{{ o.mensaje }}</p>
            </div>
          }
        </div>
      } @else if (!cargando()) {
        <dynadrill-text variant="caption"
          >Todavía no hay observaciones registradas en este ticket.</dynadrill-text
        >
      }

      @if (!data.cerrado) {
        <dynadrill-textarea
          label="Agregar observación"
          placeholder="Detalle lo que sea necesario para entender el proceso…"
          [rows]="3"
          [value]="mensaje()"
          (valueChange)="mensaje.set($event)"
        />
      } @else {
        <dynadrill-text variant="caption"
          >El ticket está cerrado: ya no admite observaciones.</dynadrill-text
        >
      }
    </section>

    <footer class="fcr-dialog__actions">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      @if (!data.cerrado) {
        <dynadrill-button
          variant="primary"
          [disabled]="!puedeEnviar() || enviando()"
          (clicked)="agregar()"
          >Agregar observación</dynadrill-button
        >
      }
    </footer>
  `,
})
export class TicketFcrObservacionesDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketFcrObservacionesDialog, void>);
  protected readonly data = inject<TicketFcrObservacionesDialogData>(NZ_MODAL_DATA);

  protected readonly observaciones = signal<ObservacionTicket[]>([]);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly puedeEnviar = computed(() => this.mensaje().trim() !== '');

  constructor() {
    this.servicio.observaciones(this.data.ticketId).subscribe({
      next: (l) => {
        this.observaciones.set(l);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error(
          'Error',
          mensajeErrorTicket(err, 'No se pudo cargar las observaciones. Intente de nuevo.'),
        );
      },
    });
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected agregar(): void {
    if (!this.puedeEnviar() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.agregarObservacion(this.data.ticketId, this.mensaje().trim()).subscribe({
      next: (o) => {
        this.observaciones.update((l) => [...l, o]);
        this.mensaje.set('');
        this.enviando.set(false);
      },
      error: (err) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo agregar',
          mensajeErrorTicket(err, 'No se pudo agregar la observación. Intente de nuevo.'),
        );
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close();
  }
}
