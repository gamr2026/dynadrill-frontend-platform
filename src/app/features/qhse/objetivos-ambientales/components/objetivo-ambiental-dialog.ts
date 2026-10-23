import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  accionEnBlanco,
  accionesConContenido,
  type AccionPlanBorrador,
  type CrearObjetivo,
  type Frecuencia,
  type ObjetivoDetalle,
} from '../models/objetivo-ambiental.model';
import { ObjetivoAmbientalService } from '../services/objetivo-ambiental.service';
import { PersonasQhseService, type PersonaQhse } from '../../shared/services/personas-qhse.service';
import { toLocalDateString } from '../../../../shared/utils';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';

/** QHSE evalúa y actualiza estos objetivos (revisión anual) — no es un registro que abra el personal operativo. */
@Component({
  selector: 'app-objetivo-ambiental-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillDatetimePickerComponent,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-dialog.html',
  styleUrl: './objetivo-ambiental-dialog.scss',
})
export class ObjetivoAmbientalDialog {
  private readonly service = inject(ObjetivoAmbientalService);
  private readonly personasService = inject(PersonasQhseService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<ObjetivoAmbientalDialog, ObjetivoDetalle | undefined>,
  );

  protected readonly submitting = signal(false);

  // Objetivo
  protected readonly titulo = signal('');
  protected readonly objetivoAmbiental = signal('');
  protected readonly meta = signal('');
  protected readonly indicador = signal('');
  protected readonly beneficioEmpresarial = signal('');
  protected readonly plazo = signal<Date | null>(null);

  // Plan de acción: una acción por fila (se parte con una en blanco)
  protected readonly acciones = signal<AccionPlanBorrador[]>([accionEnBlanco()]);

  private readonly personas = signal<PersonaQhse[]>([]);
  private readonly frecuencias = signal<Frecuencia[]>([]);
  protected readonly opcionesPersonas = computed<DynadrillSelectOption[]>(() =>
    this.personas().map((p) => ({ label: p.nombre, value: p.id })),
  );
  protected readonly opcionesFrecuencias = computed<DynadrillSelectOption[]>(() =>
    this.frecuencias().map((f) => ({ label: f.nombre, value: f.id })),
  );

  protected readonly puedeGuardar = computed(
    () =>
      this.titulo().trim().length > 0 &&
      this.objetivoAmbiental().trim().length > 0 &&
      this.meta().trim().length > 0 &&
      this.indicador().trim().length > 0,
  );

  constructor() {
    this.service.catalogos().subscribe({
      next: (c) => this.frecuencias.set(c.frecuencias),
      error: (e) =>
        this.notify.error('Error', mensajeDeError(e, 'No se pudieron cargar las frecuencias.')),
    });
    this.personasService.responsables().subscribe((p) => this.personas.set(p));
  }

  protected setAccion(i: number, cambios: Partial<AccionPlanBorrador>): void {
    this.acciones.update((filas) => filas.map((f, k) => (k === i ? { ...f, ...cambios } : f)));
  }

  protected agregarAccion(): void {
    this.acciones.update((filas) => [...filas, accionEnBlanco()]);
  }

  protected quitarAccion(i: number): void {
    this.acciones.update((filas) =>
      filas.length > 1 ? filas.filter((_, k) => k !== i) : [accionEnBlanco()],
    );
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const plazo = this.plazo();
    const input: CrearObjetivo = {
      titulo: this.titulo().trim(),
      objetivo: this.objetivoAmbiental().trim(),
      meta: this.meta().trim(),
      indicador: this.indicador().trim(),
      ...(this.beneficioEmpresarial().trim()
        ? { beneficioEmpresarial: this.beneficioEmpresarial().trim() }
        : {}),
      ...(plazo ? { plazo: toLocalDateString(plazo) } : {}),
      planAccion: accionesConContenido(this.acciones()),
    };

    this.service.create(input).subscribe({
      next: (objetivo) => {
        this.notify.success('Registrado', `Objetivo ambiental ${objetivo.codigo} registrado.`);
        this.modalRef.close(objetivo);
      },
      error: (e) => {
        this.submitting.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudo registrar el objetivo ambiental.'),
        );
      },
    });
  }
}
