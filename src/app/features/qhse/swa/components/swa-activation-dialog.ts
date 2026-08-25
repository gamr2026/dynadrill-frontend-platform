import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { CreateSwaInput, SWA_ZERO_RETALIATION_NOTICE, SwaEvento } from '../models/swa.model';
import { SwaService } from '../services/swa.service';

/**
 * "Cualquier Trabajador" activa el botón de pánico digital
 * (HSE-SEGUIMIENTO-003) — se abre desde "Reportar" en el header, sin pasar
 * por el roleGuard de QHSE. La política de cero represalias va siempre
 * visible, no es opcional.
 */
@Component({
  selector: 'app-swa-activation-dialog',
  imports: [DynadrillBannerComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './swa-activation-dialog.html',
  styleUrl: './swa-activation-dialog.scss',
})
export class SwaActivationDialog {
  private readonly swaService = inject(SwaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<SwaActivationDialog, SwaEvento | undefined>);

  protected readonly zeroRetaliationNotice = SWA_ZERO_RETALIATION_NOTICE;

  protected readonly activadoPorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly tipoPeligro = signal('');
  protected readonly descripcion = signal('');
  protected readonly ubicacion = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeActivar = computed(() => this.tipoPeligro().trim().length > 0 && this.descripcion().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected activar(): void {
    if (!this.puedeActivar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateSwaInput = {
      activadoPorNombre: this.activadoPorNombre(),
      tipoPeligro: this.tipoPeligro(),
      descripcion: this.descripcion(),
      ubicacion: this.ubicacion() || undefined,
    };

    this.swaService.activar(input).subscribe({
      next: evento => {
        this.notify.success('Trabajo detenido', `Evento ${evento.code} registrado — se notificó a Supervisor, Coordinador HSE y Gerente HSE.`);
        this.modalRef.close(evento);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el evento.');
      },
    });
  }
}
