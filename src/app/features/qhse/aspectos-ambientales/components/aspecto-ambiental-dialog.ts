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
import {
  CLASIFICACION_LABELS,
  CONDICION_OPERACION_LABELS,
  ESTADO_CONTROL_LABELS,
  TIPO_IMPACTO_LABELS,
  TIPO_RESPONSABILIDAD_LABELS,
  escala1a5,
  nivelRiesgo,
  presupuestoDeTexto,
  type AspectoDetalle,
  type CatalogosAspectos,
  type Clasificacion,
  type CondicionOperacion,
  type CrearAspecto,
  type EstadoControl,
  type TipoImpacto,
  type TipoResponsabilidad,
} from '../models/aspecto-ambiental.model';
import { AspectoAmbientalService } from '../services/aspecto-ambiental.service';
import { PersonasQhseService, type PersonaQhse } from '../../shared/services/personas-qhse.service';
import { toLocalDateString } from '../../../../shared/utils';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';

/** Opciones de un conjunto fijo (enum de la base) con la etiqueta en español. */
function opciones<T extends string>(
  valores: readonly T[],
  etiquetas: Record<T, string>,
): DynadrillSelectOption[] {
  return valores.map((v) => ({ label: etiquetas[v], value: v }));
}

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
  private readonly personasService = inject(PersonasQhseService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<AspectoAmbientalDialog, AspectoDetalle | undefined>,
  );

  protected readonly submitting = signal(false);
  private readonly catalogos = signal<CatalogosAspectos | null>(null);
  private readonly personas = signal<PersonaQhse[]>([]);

  // Opciones (catálogos de la base y conjuntos fijos)
  protected readonly opcionesEtapas = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.etapas ?? []).map((e) => ({ label: e.nombre, value: e.id })),
  );
  protected readonly opcionesProcesos = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.procesos ?? []).map((p) => ({ label: p.nombre, value: p.id })),
  );
  protected readonly opcionesFactores = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.factores ?? []).map((f) => ({ label: f.nombre, value: f.id })),
  );
  protected readonly opcionesFrecuencias = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.frecuencias ?? []).map((f) => ({ label: f.nombre, value: f.id })),
  );
  protected readonly opcionesPersonas = computed<DynadrillSelectOption[]>(() =>
    this.personas().map((p) => ({ label: p.nombre, value: p.id })),
  );
  protected readonly clasificacionOptions = opciones(
    ['bajo', 'moderado', 'alto'] as const,
    CLASIFICACION_LABELS,
  );
  protected readonly condicionOptions = opciones(
    ['normal', 'anormal', 'emergencia'] as const,
    CONDICION_OPERACION_LABELS,
  );
  protected readonly responsabilidadOptions = opciones(
    ['directa', 'indirecta'] as const,
    TIPO_RESPONSABILIDAD_LABELS,
  );
  protected readonly impactoOptions = opciones(
    ['positivo', 'negativo'] as const,
    TIPO_IMPACTO_LABELS,
  );
  protected readonly estadoControlOptions = opciones(
    ['pendiente', 'en_ejecucion', 'implementado'] as const,
    ESTADO_CONTROL_LABELS,
  );

  // Identificación
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly etapaId = signal('');
  protected readonly procesoId = signal('');
  protected readonly actividad = signal('');
  protected readonly produccionDelAspecto = signal('');
  protected readonly riesgoGestion = signal('');
  protected readonly aspecto = signal('');
  protected readonly impacto = signal('');
  protected readonly factorId = signal('');
  protected readonly condicionOperacion = signal<CondicionOperacion | ''>('');
  protected readonly tipoResponsabilidad = signal<TipoResponsabilidad | ''>('');
  protected readonly tipoImpacto = signal<TipoImpacto | ''>('');

  // Valoración del riesgo ambiental
  protected readonly fechaValoracion = signal<Date | null>(null);
  protected readonly probabilidad = signal('1');
  protected readonly consecuencia = signal('1');
  protected readonly clasificacion = signal<Clasificacion>('bajo');

  // Control del aspecto e impacto
  protected readonly ncar = signal('');
  protected readonly planAccionExistente = signal('');
  protected readonly planTratamiento = signal('');
  protected readonly responsableId = signal('');
  protected readonly presupuesto = signal('');
  protected readonly plazo = signal<Date | null>(null);
  protected readonly estadoControl = signal<EstadoControl>('pendiente');

  // Seguimiento y monitoreo (los registros de seguimiento se agregan después, desde el detalle)
  protected readonly seguimientoIndicador = signal('');
  protected readonly seguimientoResponsableId = signal('');
  protected readonly seguimientoFrecuenciaId = signal('');

  protected readonly nivelRiesgoPreview = computed(() => {
    const p = escala1a5(this.probabilidad());
    const c = escala1a5(this.consecuencia());
    return p !== null && c !== null ? nivelRiesgo(p, c) : '—';
  });

  protected readonly presupuestoInvalido = computed(
    () => presupuestoDeTexto(this.presupuesto()) === null,
  );

  protected readonly puedeGuardar = computed(
    () =>
      this.etapaId() !== '' &&
      this.procesoId() !== '' &&
      this.actividad().trim().length > 0 &&
      this.aspecto().trim().length > 0 &&
      this.impacto().trim().length > 0 &&
      this.fecha() !== null &&
      escala1a5(this.probabilidad()) !== null &&
      escala1a5(this.consecuencia()) !== null &&
      !this.presupuestoInvalido(),
  );

  constructor() {
    this.service.catalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: (e) =>
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudieron cargar los catálogos de la matriz.'),
        ),
    });
    this.personasService.responsables().subscribe((p) => this.personas.set(p));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const fecha = this.fecha() as Date;
    const valoracion = this.fechaValoracion();
    const plazo = this.plazo();
    const presupuesto = presupuestoDeTexto(this.presupuesto());
    const texto = (s: string) => s.trim() || undefined;
    const input: CrearAspecto = {
      fecha: toLocalDateString(fecha),
      etapaId: this.etapaId(),
      procesoId: this.procesoId(),
      actividad: this.actividad().trim(),
      produccionDelAspecto: texto(this.produccionDelAspecto()),
      riesgoGestion: texto(this.riesgoGestion()),
      aspecto: this.aspecto().trim(),
      impacto: this.impacto().trim(),
      factorId: this.factorId() || undefined,
      condicionOperacion: this.condicionOperacion() || undefined,
      tipoResponsabilidad: this.tipoResponsabilidad() || undefined,
      tipoImpacto: this.tipoImpacto() || undefined,
      fechaValoracion: valoracion ? toLocalDateString(valoracion) : undefined,
      probabilidad: escala1a5(this.probabilidad()) as number,
      consecuencia: escala1a5(this.consecuencia()) as number,
      clasificacion: this.clasificacion(),
      ncar: texto(this.ncar()),
      planAccionExistente: texto(this.planAccionExistente()),
      planTratamiento: texto(this.planTratamiento()),
      responsableId: this.responsableId() || undefined,
      presupuesto: presupuesto ?? undefined,
      plazo: plazo ? toLocalDateString(plazo) : undefined,
      estadoControl: this.estadoControl(),
      seguimientoIndicador: texto(this.seguimientoIndicador()),
      seguimientoResponsableId: this.seguimientoResponsableId() || undefined,
      seguimientoFrecuenciaId: this.seguimientoFrecuenciaId() || undefined,
    };

    this.service.create(input).subscribe({
      next: (aspecto) => {
        this.notify.success('Registrado', `Aspecto ambiental ${aspecto.codigo} registrado.`);
        this.modalRef.close(aspecto);
      },
      error: (e) => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo registrar el aspecto ambiental.'));
      },
    });
  }
}
