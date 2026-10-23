import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  CLASIFICACION_LABELS,
  CONDICION_OPERACION_LABELS,
  ESTADO_CONTROL_LABELS,
  PERMISO_ASPECTOS_GESTIONAR,
  TIPO_IMPACTO_LABELS,
  TIPO_RESPONSABILIDAD_LABELS,
  type AspectoDetalle,
  type Clasificacion,
  type EstadoControl,
} from '../models/aspecto-ambiental.model';
import { AspectoAmbientalService } from '../services/aspecto-ambiental.service';

export interface AspectoAmbientalDetailDialogData {
  id: string;
}

const TONE: Record<Clasificacion, DynadrillTagVariant> = {
  bajo: 'success',
  moderado: 'warning',
  alto: 'error',
};

const OPCIONES_CONTROL: DynadrillSelectOption[] = (
  ['pendiente', 'en_ejecucion', 'implementado'] as const
).map((v) => ({ label: ESTADO_CONTROL_LABELS[v], value: v }));

const OPCIONES_EFICAZ: DynadrillSelectOption[] = [
  { label: 'Sí, los controles fueron eficaces', value: 'si' },
  { label: 'No fueron eficaces', value: 'no' },
];

/**
 * Detalle de un Aspecto Ambiental — mismo patrón que StopCardDetailDialog/EntregaEpiDetailDialog. Con el aspecto vigente, quien gestiona actualiza el
 * estado del control, registra seguimientos (eficacia de los controles: no se reescriben) o lo da de baja con su motivo.
 */
@Component({
  selector: 'app-aspecto-ambiental-detail-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DatePipe,
    DynadrillContextCardComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspecto-ambiental-detail-dialog.html',
  styleUrl: './aspecto-ambiental-detail-dialog.scss',
})
export class AspectoAmbientalDetailDialog {
  private readonly data = inject<AspectoAmbientalDetailDialogData>(NZ_MODAL_DATA);
  private readonly service = inject(AspectoAmbientalService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly aspecto = signal<AspectoDetalle | null>(null);
  protected readonly enviando = signal(false);
  protected readonly opcionesControl = OPCIONES_CONTROL;
  protected readonly opcionesEficaz = OPCIONES_EFICAZ;

  protected readonly puedeGestionar = computed(
    () => this.auth.can(PERMISO_ASPECTOS_GESTIONAR) && this.aspecto()?.estado === 'vigente',
  );
  protected readonly clasificacionLabel = computed(() => {
    const a = this.aspecto();
    return a ? `${CLASIFICACION_LABELS[a.clasificacion]} — nivel ${a.nivelRiesgo}` : '';
  });
  protected readonly clasificacionTone = computed(() => {
    const a = this.aspecto();
    return a ? TONE[a.clasificacion] : 'neutral';
  });

  // Formularios
  protected readonly nuevoEstadoControl = signal<EstadoControl | ''>('');
  protected readonly eficaz = signal('');
  protected readonly observacion = signal('');
  protected readonly motivoBaja = signal('');

  protected readonly puedeActualizarControl = computed(
    () =>
      this.nuevoEstadoControl() !== '' &&
      this.nuevoEstadoControl() !== this.aspecto()?.estadoControl,
  );
  protected readonly puedeRegistrarSeguimiento = computed(
    () =>
      (this.eficaz() === 'si' || this.eficaz() === 'no') && this.observacion().trim().length > 0,
  );
  protected readonly puedeDarDeBaja = computed(() => this.motivoBaja().trim().length > 0);

  protected readonly identificacionItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.aspecto();
    if (!a) return [];
    return [
      { label: 'Fecha de registro', value: a.fecha },
      { label: 'Etapa del ciclo de vida', value: a.etapa.nombre },
      { label: 'Proceso', value: a.proceso.nombre || '—' },
      { label: 'Actividad / Lugar / Fuente', value: a.actividad },
      { label: 'Producción del aspecto', value: a.produccionDelAspecto || '—' },
      { label: 'Aspecto ambiental', value: a.aspecto },
      { label: 'Impacto ambiental', value: a.impacto },
      { label: 'Factor ambiental', value: a.factor?.nombre || '—' },
      {
        label: 'Condiciones de operación',
        value: a.condicionOperacion ? CONDICION_OPERACION_LABELS[a.condicionOperacion] : '—',
      },
      {
        label: 'Tipo de responsabilidad',
        value: a.tipoResponsabilidad ? TIPO_RESPONSABILIDAD_LABELS[a.tipoResponsabilidad] : '—',
      },
      { label: 'Tipo de impacto', value: a.tipoImpacto ? TIPO_IMPACTO_LABELS[a.tipoImpacto] : '—' },
    ];
  });

  protected readonly controlItems = computed<DynadrillContextCardItem[]>(() => {
    const c = this.aspecto()?.control;
    if (!c) return [];
    return [
      { label: 'NCAR', value: c.ncar || '—' },
      { label: 'Responsable', value: c.responsable?.nombre || '—' },
      { label: 'Presupuesto', value: c.presupuesto === null ? '—' : c.presupuesto.toFixed(2) },
      { label: 'Plazo', value: c.plazo || '—' },
      { label: 'Estado', value: ESTADO_CONTROL_LABELS[c.estadoControl] },
      { label: 'Plan de acción existente', value: c.planAccionExistente || '—' },
      { label: 'Plan de tratamiento', value: c.planTratamiento || '—' },
    ];
  });

  protected readonly seguimientoItems = computed<DynadrillContextCardItem[]>(() => {
    const s = this.aspecto()?.seguimiento;
    if (!s) return [];
    return [
      { label: 'Indicador', value: s.indicador || '—' },
      { label: 'Responsable', value: s.responsable?.nombre || '—' },
      { label: 'Frecuencia', value: s.frecuencia?.nombre || '—' },
      {
        label: 'Eficacia de controles (último registro)',
        value: s.ultimaEficacia === null ? '—' : s.ultimaEficacia ? 'Eficaces' : 'No eficaces',
      },
    ];
  });

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.service.get(this.data.id).subscribe({
      next: (a) => this.aspecto.set(a),
      error: (e) =>
        this.notify.error('Error', mensajeDeError(e, 'No se pudo cargar el aspecto ambiental.')),
    });
  }

  protected actualizarControl(): void {
    const a = this.aspecto();
    const estado = this.nuevoEstadoControl();
    if (!a || estado === '' || !this.puedeActualizarControl() || this.enviando()) return;
    this.enviando.set(true);
    this.service.update(a.id, { estadoControl: estado }).subscribe({
      next: (actualizado) => {
        this.aspecto.set(actualizado);
        this.nuevoEstadoControl.set('');
        this.enviando.set(false);
        this.notify.success('Actualizado', 'El estado del control quedó actualizado.');
      },
      error: (e) => {
        this.enviando.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo actualizar el control.'));
      },
    });
  }

  protected registrarSeguimiento(): void {
    const a = this.aspecto();
    if (!a || !this.puedeRegistrarSeguimiento() || this.enviando()) return;
    this.enviando.set(true);
    this.service
      .registrarSeguimiento(a.id, {
        eficaz: this.eficaz() === 'si',
        observacion: this.observacion().trim(),
      })
      .subscribe({
        next: (actualizado) => {
          this.aspecto.set(actualizado);
          this.eficaz.set('');
          this.observacion.set('');
          this.enviando.set(false);
          this.notify.success('Registrado', 'El seguimiento quedó registrado.');
        },
        error: (e) => {
          this.enviando.set(false);
          this.notify.error('Error', mensajeDeError(e, 'No se pudo registrar el seguimiento.'));
        },
      });
  }

  protected darDeBaja(): void {
    const a = this.aspecto();
    if (!a || !this.puedeDarDeBaja() || this.enviando()) return;
    this.enviando.set(true);
    this.service.darDeBaja(a.id, this.motivoBaja().trim()).subscribe({
      next: (actualizado) => {
        this.aspecto.set(actualizado);
        this.enviando.set(false);
        this.notify.success('Dado de baja', 'El aspecto ambiental quedó dado de baja.');
      },
      error: (e) => {
        this.enviando.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo dar de baja el aspecto.'));
      },
    });
  }
}
