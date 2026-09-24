import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillContextCardComponent, DynadrillTagComponent, type DynadrillContextCardItem, type DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';
import { AspectoAmbiental, CLASIFICACION_LABELS, nivelRiesgo } from '../models/aspecto-ambiental.model';

export interface AspectoAmbientalDetailDialogData {
  aspecto: AspectoAmbiental;
}

const TONE: Record<AspectoAmbiental['clasificacion'], DynadrillTagVariant> = {
  BAJO: 'success',
  MODERADO: 'warning',
  ALTO: 'error',
};

/** Detalle de solo lectura de un Aspecto Ambiental — mismo patrón que StopCardDetailDialog/EntregaEpiDetailDialog. */
@Component({
  selector: 'app-aspecto-ambiental-detail-dialog',
  imports: [DynadrillContextCardComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspecto-ambiental-detail-dialog.html',
  styleUrl: './aspecto-ambiental-detail-dialog.scss',
})
export class AspectoAmbientalDetailDialog {
  private readonly data = inject<AspectoAmbientalDetailDialogData>(NZ_MODAL_DATA);

  protected readonly aspecto = this.data.aspecto;
  protected readonly clasificacionLabels = CLASIFICACION_LABELS;
  protected readonly clasificacionTone = TONE[this.aspecto.clasificacion];
  protected readonly nivel = nivelRiesgo(this.aspecto);

  protected readonly identificacionItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.aspecto;
    return [
      { label: 'Fecha de registro', value: a.fecha },
      { label: 'Etapa del ciclo de vida', value: a.etapaCicloVida || '—' },
      { label: 'Proceso', value: a.proceso },
      { label: 'Actividad / Lugar / Fuente', value: a.actividad },
      { label: 'Aspecto ambiental', value: a.aspectoAmbiental },
      { label: 'Impacto ambiental', value: a.impactoAmbiental },
      { label: 'Factor ambiental', value: a.factorAmbiental || '—' },
      { label: 'Tipo de impacto', value: a.tipoImpacto || '—' },
    ];
  });

  protected readonly controlItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.aspecto;
    return [
      { label: 'NCAR', value: a.ncar || '—' },
      { label: 'Responsable', value: a.responsable || '—' },
      { label: 'Plazo', value: a.plazo || '—' },
      { label: 'Estado', value: a.estadoControl || '—' },
      { label: 'Plan de acción existente', value: a.planAccionExistente || '—' },
      { label: 'Plan de tratamiento', value: a.planTratamiento || '—' },
    ];
  });

  protected readonly seguimientoItems = computed<DynadrillContextCardItem[]>(() => {
    const a = this.aspecto;
    return [
      { label: 'Indicador', value: a.seguimientoIndicador || '—' },
      { label: 'Responsable', value: a.seguimientoResponsable || '—' },
      { label: 'Frecuencia', value: a.seguimientoFrecuencia || '—' },
      { label: 'Estado', value: a.seguimientoEstado || '—' },
      { label: 'Eficacia de controles', value: a.eficaciaControles || '—' },
    ];
  });
}
