import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ObjetivoAmbiental, CreateObjetivoAmbientalInput } from '../models/objetivo-ambiental.model';
import { ObjetivoAmbientalService } from '../services/objetivo-ambiental.service';
import { toLocalDateString } from '../../../../shared/utils';

/** QHSE evalúa y actualiza estos objetivos (revisión anual) — no es un registro que abra el personal operativo. */
@Component({
  selector: 'app-objetivo-ambiental-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillDatetimePickerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-dialog.html',
  styleUrl: './objetivo-ambiental-dialog.scss',
})
export class ObjetivoAmbientalDialog {
  private readonly service = inject(ObjetivoAmbientalService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ObjetivoAmbientalDialog, ObjetivoAmbiental | undefined>);

  protected readonly submitting = signal(false);

  // Objetivo
  protected readonly titulo = signal('');
  protected readonly objetivoAmbiental = signal('');
  protected readonly meta = signal('');
  protected readonly indicador = signal('');
  protected readonly beneficioEmpresarial = signal('');
  protected readonly plazo = signal<Date | null>(null);
  protected readonly resultado = signal('');
  protected readonly evidencia = signal('');

  // Plan de acción
  protected readonly accionEspecifica = signal('');
  protected readonly responsable = signal('');
  protected readonly evidenciaPlan = signal('');
  protected readonly indicadorPlan = signal('');
  protected readonly frecuencia = signal('');
  protected readonly periodoEvaluacion = signal<Date | null>(null);

  protected readonly puedeGuardar = computed(
    () =>
      this.titulo().trim().length > 0 &&
      this.objetivoAmbiental().trim().length > 0 &&
      this.meta().trim().length > 0 &&
      this.indicador().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateObjetivoAmbientalInput = {
      titulo: this.titulo().trim(),
      plazo: this.plazo() ? toLocalDateString(this.plazo()!) : undefined,
      objetivoAmbiental: this.objetivoAmbiental().trim(),
      meta: this.meta().trim(),
      indicador: this.indicador().trim(),
      beneficioEmpresarial: this.beneficioEmpresarial().trim() || undefined,
      resultado: this.resultado().trim() || undefined,
      evidencia: this.evidencia().trim() || undefined,
      planAccion: {
        accionEspecifica: this.accionEspecifica().trim() || undefined,
        responsable: this.responsable().trim() || undefined,
        evidencia: this.evidenciaPlan().trim() || undefined,
        indicador: this.indicadorPlan().trim() || undefined,
        frecuencia: this.frecuencia().trim() || undefined,
        periodoEvaluacion: this.periodoEvaluacion() ? toLocalDateString(this.periodoEvaluacion()!) : undefined,
      },
    };

    this.service.create(input).subscribe({
      next: objetivo => {
        this.notify.success('Registrado', `Objetivo ambiental ${objetivo.code} registrado.`);
        this.modalRef.close(objetivo);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el objetivo ambiental.');
      },
    });
  }
}
