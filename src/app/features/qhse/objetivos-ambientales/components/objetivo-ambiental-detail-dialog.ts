import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  ESTADO_OBJETIVO_LABELS,
  ESTADO_OBJETIVO_TONO,
  PERMISO_OBJETIVOS_GESTIONAR,
  estadoVisible,
  type ObjetivoDetalle,
} from '../models/objetivo-ambiental.model';
import { ObjetivoAmbientalService } from '../services/objetivo-ambiental.service';

export interface ObjetivoAmbientalDetailDialogData {
  id: string;
}

const OPCIONES_CIERRE: DynadrillSelectOption[] = [
  { label: 'Cumplido', value: 'cumplido' },
  { label: 'No cumplido', value: 'no_cumplido' },
];

/**
 * Detalle de un Objetivo Ambiental — mismo patrón que AspectoAmbientalDetailDialog. Con el objetivo en curso, quien gestiona registra su
 * seguimiento (avance y observación, que no se reescriben) y lo cierra como cumplido o no cumplido, con su resultado.
 */
@Component({
  selector: 'app-objetivo-ambiental-detail-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DatePipe,
    DynadrillContextCardComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-detail-dialog.html',
  styleUrl: './objetivo-ambiental-detail-dialog.scss',
})
export class ObjetivoAmbientalDetailDialog {
  private readonly data = inject<ObjetivoAmbientalDetailDialogData>(NZ_MODAL_DATA);
  private readonly service = inject(ObjetivoAmbientalService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly objetivo = signal<ObjetivoDetalle | null>(null);
  protected readonly enviando = signal(false);
  protected readonly opcionesCierre = OPCIONES_CIERRE;

  protected readonly puedeGestionar = computed(
    () => this.auth.can(PERMISO_OBJETIVOS_GESTIONAR) && this.objetivo()?.estado === 'en_curso',
  );
  protected readonly estado = computed(() => {
    const o = this.objetivo();
    return o ? estadoVisible(o) : 'sin_plazo';
  });
  protected readonly estadoLabel = computed(() => ESTADO_OBJETIVO_LABELS[this.estado()]);
  protected readonly estadoTone = computed(() => ESTADO_OBJETIVO_TONO[this.estado()]);

  // Formulario de seguimiento
  protected readonly avance = signal('');
  protected readonly observacion = signal('');
  // Formulario de cierre
  protected readonly estadoCierre = signal('');
  protected readonly resultado = signal('');
  protected readonly evidencia = signal('');

  protected readonly puedeRegistrarSeguimiento = computed(() => {
    const n = Number(this.avance());
    return (
      this.avance() !== '' &&
      Number.isInteger(n) &&
      n >= 0 &&
      n <= 100 &&
      this.observacion().trim().length > 0
    );
  });
  protected readonly puedeCerrar = computed(
    () =>
      (this.estadoCierre() === 'cumplido' || this.estadoCierre() === 'no_cumplido') &&
      this.resultado().trim().length > 0,
  );

  protected readonly objetivoItems = computed<DynadrillContextCardItem[]>(() => {
    const o = this.objetivo();
    if (!o) return [];
    return [
      { label: 'Objetivo ambiental', value: o.objetivo },
      { label: 'Meta', value: o.meta },
      { label: 'Indicador', value: o.indicador },
      { label: 'Plazo', value: o.plazo || '—' },
      { label: 'Avance actual', value: o.avanceActual === null ? '—' : `${o.avanceActual}%` },
      { label: 'Beneficio empresarial', value: o.beneficioEmpresarial || '—' },
      { label: 'Resultado', value: o.resultado || '—' },
      { label: 'Evidencia', value: o.evidencia || '—' },
    ];
  });

  /** Una tarjeta por acción del plan (en la demo era una sola). */
  protected readonly planAccionItems = computed<DynadrillContextCardItem[][]>(() =>
    (this.objetivo()?.planAccion ?? []).map((a) => [
      { label: 'Acción específica', value: a.accionEspecifica },
      { label: 'Responsable', value: a.responsable?.nombre || '—' },
      { label: 'Frecuencia', value: a.frecuencia?.nombre || '—' },
      { label: 'Indicador', value: a.indicador || '—' },
      { label: 'Evidencia', value: a.evidenciaEsperada || '—' },
    ]),
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.service.get(this.data.id).subscribe({
      next: (o) => this.objetivo.set(o),
      error: (e) =>
        this.notify.error('Error', mensajeDeError(e, 'No se pudo cargar el objetivo ambiental.')),
    });
  }

  protected registrarSeguimiento(): void {
    const o = this.objetivo();
    if (!o || !this.puedeRegistrarSeguimiento() || this.enviando()) return;
    this.enviando.set(true);
    this.service
      .registrarSeguimiento(o.id, {
        avancePorcentaje: Number(this.avance()),
        observacion: this.observacion().trim(),
      })
      .subscribe({
        next: (actualizado) => {
          this.objetivo.set(actualizado);
          this.avance.set('');
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

  protected cerrar(): void {
    const o = this.objetivo();
    if (!o || !this.puedeCerrar() || this.enviando()) return;
    this.enviando.set(true);
    this.service
      .cerrar(o.id, {
        estado: this.estadoCierre() as 'cumplido' | 'no_cumplido',
        resultado: this.resultado().trim(),
        ...(this.evidencia().trim() ? { evidencia: this.evidencia().trim() } : {}),
      })
      .subscribe({
        next: (actualizado) => {
          this.objetivo.set(actualizado);
          this.enviando.set(false);
          this.notify.success(
            'Cerrado',
            `El objetivo quedó ${actualizado.estado === 'cumplido' ? 'cumplido' : 'no cumplido'}.`,
          );
        },
        error: (e) => {
          this.enviando.set(false);
          this.notify.error('Error', mensajeDeError(e, 'No se pudo cerrar el objetivo.'));
        },
      });
  }
}
