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
import {
  CreateDerrameInput,
  DERRAME_UBICACION_LABELS,
  DERRAME_VOLUMEN_LABELS,
  DerrameEvento,
  DerrameUbicacion,
  DerrameVolumen,
} from '../models/derrame.model';
import { DerrameService } from '../services/derrame.service';
import { parseServicio, useServiciosOperativosOptions } from '../../shared/utils/servicio-operativo.util';

const VOLUMEN_OPTIONS: DynadrillSelectOption[] = (Object.entries(DERRAME_VOLUMEN_LABELS) as [DerrameVolumen, string][]).map(
  ([value, label]) => ({ label, value }),
);
const UBICACION_OPTIONS: DynadrillSelectOption[] = (Object.entries(DERRAME_UBICACION_LABELS) as [DerrameUbicacion, string][]).map(
  ([value, label]) => ({ label, value }),
);

/** "Personal que Detecta Derrame activa el botón de alerta" (HSE-AMBIENTAL-002) — abre desde "Reportar", sin roleGuard de QHSE. */
@Component({
  selector: 'app-derrame-alert-dialog',
  imports: [DynadrillBannerComponent, DynadrillSelectComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-alert-dialog.html',
  styleUrl: './derrame-alert-dialog.scss',
})
export class DerrameAlertDialog {
  private readonly derrameService = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<DerrameAlertDialog, DerrameEvento | undefined>);

  protected readonly volumenOptions = VOLUMEN_OPTIONS;
  protected readonly ubicacionOptions = UBICACION_OPTIONS;

  protected readonly activadoPorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly descripcion = signal('');
  protected readonly ubicacionFisica = signal('');
  protected readonly volumen = signal<DerrameVolumen>('menor');
  protected readonly ubicacion = signal<DerrameUbicacion>('geomembrana');
  protected readonly servicio = signal('');
  protected readonly servicioOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly submitting = signal(false);

  constructor() {
    useServiciosOperativosOptions().subscribe(opts => this.servicioOptions.set(opts));
  }

  protected readonly puedeActivar = computed(() => this.descripcion().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.puedeActivar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateDerrameInput = {
      activadoPorNombre: this.activadoPorNombre(),
      descripcion: this.descripcion(),
      ubicacionFisica: this.ubicacionFisica() || undefined,
      volumen: this.volumen(),
      ubicacion: this.ubicacion(),
      ...(parseServicio(this.servicio()) ?? {}),
    };

    this.derrameService.activar(input).subscribe({
      next: evento => {
        this.notify.success('Alerta registrada', `Evento ${evento.code} — inicia el protocolo de contención.`);
        this.modalRef.close(evento);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el derrame.');
      },
    });
  }
}
