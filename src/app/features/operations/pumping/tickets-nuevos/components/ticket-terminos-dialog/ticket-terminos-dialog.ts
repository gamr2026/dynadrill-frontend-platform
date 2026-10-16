import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillNotificationService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { mensajeErrorTicket, type TerminosVigentes } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketTerminosDialogData {
  ticketId: string;
}

/**
 * Términos y condiciones de uso de equipos. El operador asignado los lee hasta el final y los acepta con su propia cuenta: queda una
 * constancia (versión, huella del texto y hora del servidor) que no se puede modificar.
 */
@Component({
  selector: 'app-ticket-terminos-dialog',
  imports: [DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="tt">
      @if (terminos(); as t) {
        <h3 class="tt__titulo">{{ t.titulo }}</h3>
        <dynadrill-text variant="caption">Versión {{ t.codigo }} · lea hasta el final para poder aceptar.</dynadrill-text>
        <div class="tt__texto" tabindex="0" role="region" aria-label="Texto de los términos y condiciones" (scroll)="alScroll($event)">
          @for (p of parrafos(t); track $index) {
            <p>{{ p }}</p>
          }
        </div>
        <dynadrill-checkbox label="He leído y acepto estos términos y condiciones" [checked]="acepto()" [disabled]="!leido()" (checkedChange)="acepto.set($event)" />
      } @else {
        <dynadrill-text variant="body">Cargando…</dynadrill-text>
      }
    </div>
    <footer class="tt__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!acepto() || enviando()" (clicked)="aceptar()">{{ enviando() ? 'Registrando…' : 'Aceptar' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .tt { display: flex; flex-direction: column; gap: 10px; }
    .tt__titulo { margin: 0; font-size: 16px; }
    .tt__texto { max-height: 280px; overflow-y: auto; border: 1px solid #ecebf1; border-radius: 8px; padding: 10px 14px; background: #faf9fc; }
    .tt__texto p { margin: 0 0 10px; line-height: 1.45; }
    .tt__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketTerminosDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketTerminosDialog, boolean>);
  private readonly data = inject<TicketTerminosDialogData>(NZ_MODAL_DATA);

  protected readonly terminos = signal<TerminosVigentes | null>(null);
  protected readonly leido = signal(false);
  protected readonly acepto = signal(false);
  protected readonly enviando = signal(false);

  constructor() {
    this.servicio.terminosVigentes().subscribe({
      next: t => this.terminos.set(t),
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar los términos y condiciones.')),
    });
  }

  protected parrafos(t: TerminosVigentes): string[] {
    return t.texto.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  }

  /** Se habilita la casilla al llegar al final del texto. */
  protected alScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) this.leido.set(true);
  }

  protected aceptar(): void {
    if (!this.acepto() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.aceptarTerminos(this.data.ticketId).subscribe({
      next: () => {
        this.notify.success('Términos aceptados', 'Quedó registrada su aceptación.');
        this.modalRef.close(true);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo registrar', mensajeErrorTicket(err, 'No se pudo registrar la aceptación. Intente de nuevo.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(false);
  }
}
