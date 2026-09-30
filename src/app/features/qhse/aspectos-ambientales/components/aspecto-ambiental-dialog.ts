import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AspectoAmbiental, Clasificacion, CreateAspectoAmbientalInput } from '../models/aspecto-ambiental.model';
import { AspectoAmbientalService } from '../services/aspecto-ambiental.service';
import { toLocalDateString } from '../../../../shared/utils';

const CLASIFICACION_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Bajo', value: 'BAJO' },
  { label: 'Moderado', value: 'MODERADO' },
  { label: 'Alto', value: 'ALTO' },
];

/** QHSE evalúa y actualiza esta matriz — no es un registro que abra el personal operativo (a diferencia de STOP/Desechos). */
@Component({
  selector: 'app-aspecto-ambiental-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspecto-ambiental-dialog.html',
  styleUrl: './aspecto-ambiental-dialog.scss',
})
export class AspectoAmbientalDialog {
  private readonly service = inject(AspectoAmbientalService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<AspectoAmbientalDialog, AspectoAmbiental | undefined>);

  protected readonly clasificacionOptions = CLASIFICACION_OPTIONS;
  protected readonly submitting = signal(false);

  // Identificación
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly etapaCicloVida = signal('');
  protected readonly proceso = signal('');
  protected readonly actividad = signal('');
  protected readonly produccionDelAspecto = signal('');
  protected readonly riesgoGestion = signal('');
  protected readonly aspectoAmbiental = signal('');
  protected readonly impactoAmbiental = signal('');
  protected readonly factorAmbiental = signal('');
  protected readonly condicionesOperacion = signal('');
  protected readonly tipoResponsabilidad = signal('');
  protected readonly tipoImpacto = signal('');

  // Valoración del riesgo ambiental
  protected readonly fechaValoracion = signal<Date | null>(null);
  protected readonly probabilidad = signal('1');
  protected readonly consecuencia = signal('1');
  protected readonly significancia = signal('');
  protected readonly clasificacion = signal<Clasificacion>('BAJO');

  // Control del aspecto e impacto
  protected readonly ncar = signal('');
  protected readonly planAccionExistente = signal('');
  protected readonly planTratamiento = signal('');
  protected readonly responsable = signal('');
  protected readonly presupuesto = signal('');
  protected readonly plazo = signal('');
  protected readonly estadoControl = signal('');

  // Seguimiento y monitoreo
  protected readonly seguimientoIndicador = signal('');
  protected readonly seguimientoResponsable = signal('');
  protected readonly seguimientoFrecuencia = signal('');
  protected readonly seguimientoEstado = signal('');
  protected readonly eficaciaControles = signal('');

  protected readonly nivelRiesgoPreview = computed(() => Number(this.probabilidad()) * Number(this.consecuencia()));

  protected readonly puedeGuardar = computed(
    () =>
      this.proceso().trim().length > 0 &&
      this.actividad().trim().length > 0 &&
      this.aspectoAmbiental().trim().length > 0 &&
      this.impactoAmbiental().trim().length > 0 &&
      this.fecha() !== null,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateAspectoAmbientalInput = {
      clasificacion: this.clasificacion(),
      fecha: toLocalDateString(this.fecha()!),
      etapaCicloVida: this.etapaCicloVida().trim(),
      proceso: this.proceso().trim(),
      actividad: this.actividad().trim(),
      produccionDelAspecto: this.produccionDelAspecto().trim() || undefined,
      riesgoGestion: this.riesgoGestion().trim() || undefined,
      aspectoAmbiental: this.aspectoAmbiental().trim(),
      impactoAmbiental: this.impactoAmbiental().trim(),
      factorAmbiental: this.factorAmbiental().trim() || undefined,
      condicionesOperacion: this.condicionesOperacion().trim() || undefined,
      tipoResponsabilidad: this.tipoResponsabilidad().trim() || undefined,
      tipoImpacto: this.tipoImpacto().trim() || undefined,
      fechaValoracion: this.fechaValoracion() ? toLocalDateString(this.fechaValoracion()!) : undefined,
      probabilidad: Number(this.probabilidad()) || 1,
      consecuencia: Number(this.consecuencia()) || 1,
      significancia: this.significancia().trim() || undefined,
      ncar: this.ncar().trim() || undefined,
      planAccionExistente: this.planAccionExistente().trim() || undefined,
      planTratamiento: this.planTratamiento().trim() || undefined,
      responsable: this.responsable().trim() || undefined,
      presupuesto: this.presupuesto().trim() || undefined,
      plazo: this.plazo().trim() || undefined,
      estadoControl: this.estadoControl().trim() || undefined,
      seguimientoIndicador: this.seguimientoIndicador().trim() || undefined,
      seguimientoResponsable: this.seguimientoResponsable().trim() || undefined,
      seguimientoFrecuencia: this.seguimientoFrecuencia().trim() || undefined,
      seguimientoEstado: this.seguimientoEstado().trim() || undefined,
      eficaciaControles: this.eficaciaControles().trim() || undefined,
    };

    this.service.create(input).subscribe({
      next: aspecto => {
        this.notify.success('Registrado', `Aspecto ambiental ${aspecto.code} registrado.`);
        this.modalRef.close(aspecto);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el aspecto ambiental.');
      },
    });
  }
}
