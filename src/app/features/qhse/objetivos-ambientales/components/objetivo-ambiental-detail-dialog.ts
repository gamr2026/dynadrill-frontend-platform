import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillContextCardComponent, DynadrillTagComponent, type DynadrillContextCardItem, type DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';
import { ESTADO_OBJETIVO_LABELS, EstadoObjetivoAmbiental, ObjetivoAmbiental, estadoObjetivoAmbiental } from '../models/objetivo-ambiental.model';

export interface ObjetivoAmbientalDetailDialogData {
  objetivo: ObjetivoAmbiental;
}

const TONE: Record<EstadoObjetivoAmbiental, DynadrillTagVariant> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'error',
  sin_plazo: 'neutral',
};

/** Detalle de solo lectura de un Objetivo Ambiental — mismo patrón que AspectoAmbientalDetailDialog. */
@Component({
  selector: 'app-objetivo-ambiental-detail-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillContextCardComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-detail-dialog.html',
  styleUrl: './objetivo-ambiental-detail-dialog.scss',
})
export class ObjetivoAmbientalDetailDialog {
  private readonly data = inject<ObjetivoAmbientalDetailDialogData>(NZ_MODAL_DATA);

  protected readonly objetivo = this.data.objetivo;
  protected readonly estadoLabels = ESTADO_OBJETIVO_LABELS;
  protected readonly estado = estadoObjetivoAmbiental(this.objetivo.plazo);
  protected readonly estadoTone = TONE[this.estado];

  protected readonly objetivoItems = computed<DynadrillContextCardItem[]>(() => {
    const o = this.objetivo;
    return [
      { label: 'Objetivo ambiental', value: o.objetivoAmbiental },
      { label: 'Meta', value: o.meta },
      { label: 'Indicador', value: o.indicador },
      { label: 'Plazo', value: o.plazo || '—' },
      { label: 'Beneficio empresarial', value: o.beneficioEmpresarial || '—' },
      { label: 'Resultado', value: o.resultado || '—' },
      { label: 'Evidencia', value: o.evidencia || '—' },
    ];
  });

  protected readonly planAccionItems = computed<DynadrillContextCardItem[]>(() => {
    const p = this.objetivo.planAccion;
    return [
      { label: 'Acción específica', value: p?.accionEspecifica || '—' },
      { label: 'Responsable', value: p?.responsable || '—' },
      { label: 'Frecuencia', value: p?.frecuencia || '—' },
      { label: 'Periodo de evaluación', value: p?.periodoEvaluacion || '—' },
      { label: 'Indicador', value: p?.indicador || '—' },
      { label: 'Evidencia', value: p?.evidencia || '—' },
    ];
  });
}
