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
import { AuthService } from '../../../../core/services/auth.service';
import { CreateEmergenciaInput, EmergenciaEvento } from '../models/emergencia.model';
import { EmergenciaService } from '../services/emergencia.service';
import { parseServicio, useServiciosOperativosOptions } from '../../shared/utils/servicio-operativo.util';

export interface EmergenciaAlertDialogData {
  /** Prellenado al escalar desde SWA o Derrame (ver swa-detail-page / derrame-detail-page). */
  origenSwaId?: number;
  origenDerrameId?: number;
  tipoSugerido?: string;
  descripcionSugerida?: string;
  /** Servicio ya ligado al SWA/derrame que escala — se hereda sin pedirlo de nuevo. */
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
}

/**
 * "Cualquier Trabajador (Detector Inicial)" activa el botón de emergencia
 * (HSE-TRIAGE-001) — se abre desde "Reportar" en el header, sin pasar por
 * el roleGuard de QHSE, igual que STOP/SWA/Derrame. Solo captura lo mínimo
 * para arrancar el cronómetro; el resto (nivel, triage, MEDEVAC, cascada de
 * notificación, Reporte Flash) lo gestiona el staff HSE en el detalle.
 */
@Component({
  selector: 'app-emergencia-alert-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillBannerComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillSelectComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergencia-alert-dialog.html',
  styleUrl: './emergencia-alert-dialog.scss',
})
export class EmergenciaAlertDialog {
  private readonly emergenciaService = inject(EmergenciaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<EmergenciaAlertDialog, EmergenciaEvento | undefined>);
  protected readonly data = inject<EmergenciaAlertDialogData>(NZ_MODAL_DATA, { optional: true });

  protected readonly activadoPorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly tipo = signal(this.data?.tipoSugerido ?? '');
  protected readonly descripcion = signal(this.data?.descripcionSugerida ?? '');
  protected readonly ubicacion = signal('');
  /** Heredado del SWA/derrame que escala, si vino con uno ya ligado. */
  protected readonly servicioHeredado = !!this.data?.ticketCode;
  protected readonly servicio = signal(this.data?.ticketCode ? `${this.data.ticketTipo}:${this.data.ticketCode}` : '');
  protected readonly servicioOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly submitting = signal(false);

  constructor() {
    if (!this.servicioHeredado) {
      useServiciosOperativosOptions().subscribe(opts => this.servicioOptions.set(opts));
    }
  }

  protected readonly puedeActivar = computed(() => this.tipo().trim().length > 0 && this.descripcion().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.puedeActivar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateEmergenciaInput = {
      activadoPorNombre: this.activadoPorNombre(),
      tipo: this.tipo().trim(),
      descripcion: this.descripcion().trim(),
      ubicacion: this.ubicacion() || undefined,
      origenSwaId: this.data?.origenSwaId,
      origenDerrameId: this.data?.origenDerrameId,
      ...(parseServicio(this.servicio()) ?? {}),
    };

    this.emergenciaService.activar(input).subscribe({
      next: evento => {
        this.notify.success('Emergencia activada', `Evento ${evento.code} registrado — cronómetro iniciado, notifica en cascada desde el detalle.`);
        this.modalRef.close(evento);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la emergencia.');
      },
    });
  }
}
