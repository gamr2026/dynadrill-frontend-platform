import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import type {
  CatalogosEmergencia,
  EmergenciaActivarDialogData,
  TicketLigable,
} from '../models/emergencia';
import { EmergenciaService } from '../services/emergencia.service';

/** Lo que devuelve el diálogo al activar la emergencia: su id y su consecutivo. */
export interface EmergenciaActivada {
  id: string;
  codigo: string;
}

/**
 * «Cualquier trabajador (detector inicial)» activa el botón de emergencia (HSE-TRIAGE-001). Lo abren «Reportar», el detalle de una SWA y el de un
 * derrame mayor o en cuerpo de agua (con `origenSwaId` u `origenDerrameId`, que heredan su servicio). Solo captura lo mínimo para arrancar el
 * cronómetro: quién la activa es la cuenta con sesión; el nivel, el conteo, la cascada, los heridos y el Reporte Flash los gestiona el equipo HSE.
 */
@Component({
  selector: 'app-emergencia-activar-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergencia-activar-dialog.html',
  styleUrl: './emergencia-activar-dialog.scss',
})
export class EmergenciaActivarDialog {
  private readonly servicio = inject(EmergenciaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<EmergenciaActivarDialog, EmergenciaActivada | undefined>,
  );
  private readonly data = inject<EmergenciaActivarDialogData | null>(NZ_MODAL_DATA, {
    optional: true,
  });

  private readonly catalogos = signal<CatalogosEmergencia>({ tipos: [], tickets: [] });
  protected readonly tipoId = signal('');
  protected readonly descripcion = signal(this.data?.descripcionSugerida ?? '');
  protected readonly ubicacion = signal('');
  protected readonly ticketId = signal(this.data?.ticketId ?? '');
  protected readonly enviando = signal(false);

  /** Escalada desde una SWA o un derrame: el backend hereda su servicio. */
  protected readonly tieneOrigen = !!(this.data?.origenSwaId || this.data?.origenDerrameId);
  protected readonly servicioHeredado = computed(() => this.tieneOrigen || !!this.data?.ticketId);

  protected readonly opcionesTipo = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().tipos.map((t) => ({ value: t.id, label: t.nombre })),
  );
  protected readonly opcionesServicio = computed<DynadrillSelectOption[]>(() => [
    { value: '', label: 'Sin servicio' },
    ...this.catalogos().tickets.map((t) => ({ value: t.ticketId, label: etiquetaTicket(t) })),
  ]);
  protected readonly servicioTexto = computed(() => {
    const t = this.catalogos().tickets.find((x) => x.ticketId === this.data?.ticketId);
    if (t) return etiquetaTicket(t);
    return this.data?.ticketId
      ? 'Servicio del origen'
      : 'Se hereda el servicio del origen, si tiene uno';
  });
  protected readonly origenTexto = computed(() => {
    if (this.data?.origenSwaId) return 'Escalada desde una SWA (Stop Work Authority).';
    if (this.data?.origenDerrameId) return 'Escalada desde un derrame mayor o en cuerpo de agua.';
    return null;
  });
  protected readonly puedeActivar = computed(
    () => !!this.tipoId() && this.descripcion().trim().length > 0,
  );

  constructor() {
    this.servicio.catalogos().subscribe({
      next: (c) => {
        this.catalogos.set(c);
        const sugerido = c.tipos.find((t) => t.codigo === this.data?.tipoSugerido);
        if (sugerido) this.tipoId.set(sugerido.id);
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los tipos de emergencia.'),
        ),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.puedeActivar() || this.enviando()) return;
    this.enviando.set(true);
    const ubicacion = this.ubicacion().trim();
    this.servicio
      .activar({
        tipoId: this.tipoId(),
        descripcion: this.descripcion().trim(),
        ...(ubicacion ? { ubicacion } : {}),
        ...(this.ticketId() ? { ticketId: this.ticketId() } : {}),
        ...(this.data?.origenSwaId ? { origenSwaId: this.data.origenSwaId } : {}),
        ...(this.data?.origenDerrameId ? { origenDerrameId: this.data.origenDerrameId } : {}),
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            'Emergencia activada',
            `${r.codigo} registrada: cronómetro iniciado. El equipo HSE notifica en cascada desde el detalle.`,
          );
          this.modalRef.close({ id: r.id, codigo: r.codigo });
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo activar',
            mensajeDeError(err, 'No se pudo registrar la emergencia.'),
          );
        },
      });
  }
}

function etiquetaTicket(t: TicketLigable): string {
  return `Ticket ${t.ticketNumero ?? '—'} · ${t.pedidoCodigo}${t.cliente ? ` · ${t.cliente}` : ''}`;
}
