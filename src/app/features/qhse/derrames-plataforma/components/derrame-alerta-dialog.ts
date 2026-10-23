import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  AVISO_ALERTA_DERRAME,
  rangoDeBanda,
  type CatalogosDerrame,
  type DerrameActivado,
} from '../models/derrame';
import { DerrameService } from '../services/derrame.service';

/**
 * «Personal que detecta el derrame activa el botón de alerta» (HSE-AMBIENTAL-002). Lo puede abrir cualquier trabajador (también desde
 * «Reportar»): no exige permisos de QHSE. Devuelve el derrame activado al cerrarse, o nada si se cancela.
 */
@Component({
  selector: 'app-derrame-alerta-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillBannerComponent,
    DynadrillSelectComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-alerta-dialog.html',
  styleUrl: './derrame-alerta-dialog.scss',
})
export class DerrameAlertaDialog {
  private readonly servicio = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<DerrameAlertaDialog, DerrameActivado | undefined>);

  protected readonly aviso = AVISO_ALERTA_DERRAME;
  /** Quien activa es siempre quien tiene la sesión: no se captura. */
  protected readonly activadoPor = this.auth.currentUser()?.name ?? '';

  private readonly catalogos = signal<CatalogosDerrame>({
    ubicaciones: [],
    bandas: [],
    tickets: [],
  });
  protected readonly descripcion = signal('');
  protected readonly ubicacionFisica = signal('');
  protected readonly bandaId = signal('');
  protected readonly ubicacionId = signal('');
  protected readonly ticketId = signal('');
  protected readonly enviando = signal(false);

  protected readonly opcionesBanda = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().bandas.map((b) => ({
      value: b.id,
      label: `${b.nombre} · ${rangoDeBanda(b)}`,
    })),
  );
  protected readonly opcionesUbicacion = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().ubicaciones.map((u) => ({ value: u.id, label: u.nombre })),
  );
  protected readonly opcionesServicio = computed<DynadrillSelectOption[]>(() => [
    ...(this.catalogos().tickets.length ? [{ value: '', label: 'Sin servicio' }] : []),
    ...this.catalogos().tickets.map((t) => ({
      value: t.ticketId,
      label: `Ticket ${t.ticketNumero ?? '—'} · ${t.pedidoCodigo}${t.cliente ? ` · ${t.cliente}` : ''}`,
    })),
  ]);

  protected readonly puedeActivar = computed(
    () => !!this.descripcion().trim() && !!this.bandaId() && !!this.ubicacionId(),
  );

  constructor() {
    this.servicio.catalogos().subscribe({
      next: (c) => {
        this.catalogos.set(c);
        // El volumen y el lugar más comunes quedan elegidos (el primero de cada catálogo, el menor y la geomembrana); se pueden cambiar.
        this.bandaId.set(c.bandas[0]?.id ?? '');
        this.ubicacionId.set(c.ubicaciones[0]?.id ?? '');
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los catálogos del derrame.'),
        ),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.puedeActivar() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio
      .activar({
        ubicacionId: this.ubicacionId(),
        bandaId: this.bandaId(),
        descripcion: this.descripcion().trim(),
        ...(this.ubicacionFisica().trim()
          ? { ubicacionFisica: this.ubicacionFisica().trim() }
          : {}),
        ...(this.ticketId() ? { ticketId: this.ticketId() } : {}),
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            'Alerta registrada',
            `Evento ${r.codigo}: inicia el protocolo de contención.`,
          );
          this.modalRef.close(r);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(err, 'No se pudo registrar el derrame.'),
          );
        },
      });
  }
}
