import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { SWA_CERO_REPRESALIAS, type TicketDetenible, type TipoPeligro } from '../models/swa';
import { SwaService } from '../services/swa.service';

/**
 * Activa una SWA (Stop Work Authority): el «botón de pánico digital». Lo puede abrir cualquier trabajador (también desde «Reportar»).
 * Si elige el servicio, el ticket queda bloqueado hasta que el equipo HSE reanude el trabajo.
 */
@Component({
  selector: 'app-swa-activar-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sa">
      <dynadrill-text variant="caption">{{ aviso }}</dynadrill-text>
      <dynadrill-select
        label="Tipo de peligro"
        placeholder="Elija el tipo"
        [options]="opcionesTipo()"
        [value]="tipoId()"
        (valueChange)="tipoId.set($any($event))"
      />
      <dynadrill-input
        label="¿Qué peligro detuvo el trabajo?"
        [value]="descripcion()"
        (valueChange)="descripcion.set($event)"
      />
      <dynadrill-input
        label="Ubicación (opcional)"
        [value]="ubicacion()"
        (valueChange)="ubicacion.set($event)"
      />
      <dynadrill-select
        label="Servicio detenido (opcional; bloquea el ticket)"
        placeholder="Sin servicio"
        [options]="opcionesTicket()"
        [value]="ticketId()"
        [searchable]="true"
        (valueChange)="ticketId.set($any($event))"
      />
    </div>
    <footer class="sa__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="!tipoId() || !descripcion().trim() || enviando()"
        (clicked)="activar()"
        >{{ enviando() ? 'Activando…' : 'Detener el trabajo' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .sa {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sa__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class SwaActivarDialog {
  private readonly servicio = inject(SwaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<SwaActivarDialog, { id: string; codigo: string } | undefined>,
  );

  protected readonly aviso = SWA_CERO_REPRESALIAS;
  private readonly tipos = signal<TipoPeligro[]>([]);
  private readonly tickets = signal<TicketDetenible[]>([]);
  protected readonly tipoId = signal('');
  protected readonly descripcion = signal('');
  protected readonly ubicacion = signal('');
  protected readonly ticketId = signal('');
  protected readonly enviando = signal(false);
  protected readonly opcionesTipo = computed<DynadrillSelectOption[]>(() =>
    this.tipos().map((t) => ({ value: t.id, label: t.nombre })),
  );
  protected readonly opcionesTicket = computed<DynadrillSelectOption[]>(() => [
    { value: '', label: 'Sin servicio' },
    ...this.tickets().map((t) => ({
      value: t.ticketId,
      label: `Ticket ${t.ticketNumero ?? '—'} · ${t.pedidoCodigo}${t.cliente ? ` · ${t.cliente}` : ''}`,
    })),
  ]);

  constructor() {
    this.servicio.tiposDePeligro().subscribe({
      next: (t) => this.tipos.set(t),
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los tipos de peligro.'),
        ),
    });
    this.servicio
      .ticketsDetenibles()
      .subscribe({ next: (t) => this.tickets.set(t), error: () => undefined });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.tipoId() || !this.descripcion().trim() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio
      .activar({
        tipoPeligroId: this.tipoId(),
        descripcion: this.descripcion().trim(),
        ...(this.ubicacion().trim() ? { ubicacion: this.ubicacion().trim() } : {}),
        ...(this.ticketId() ? { ticketId: this.ticketId() } : {}),
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            'SWA activada',
            `${r.codigo}: se avisó al supervisor y al equipo HSE.`,
          );
          this.modalRef.close(r);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo activar',
            mensajeDeError(err, 'No se pudo activar la SWA.'),
          );
        },
      });
  }
}
