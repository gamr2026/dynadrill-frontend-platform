import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillContextCardComponent, DynadrillTagComponent, type DynadrillContextCardItem, type DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';
import { GERENCIAMIENTO_VIAJE_ESTADO_LABELS, GerenciamientoViaje, GerenciamientoViajeEstado } from '../models/gerenciamiento-viaje.model';

export interface GerenciamientoViajeDetailDialogData {
  gv: GerenciamientoViaje;
}

const ESTADO_TONE: Record<GerenciamientoViajeEstado, DynadrillTagVariant> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

const RIESGO_TONE: Record<GerenciamientoViaje['riskLevel'], DynadrillTagVariant> = {
  BAJO: 'success',
  MEDIO: 'warning',
  ALTO: 'error',
};

/** Detalle de solo lectura de un Gerenciamiento de Viaje — mismo patrón que AspectoAmbientalDetailDialog. */
@Component({
  selector: 'app-gerenciamiento-viaje-detail-dialog',
  imports: [DynadrillContextCardComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamiento-viaje-detail-dialog.html',
  styleUrl: './gerenciamiento-viaje-detail-dialog.scss',
})
export class GerenciamientoViajeDetailDialog {
  private readonly data = inject<GerenciamientoViajeDetailDialogData>(NZ_MODAL_DATA);

  protected readonly gv = this.data.gv;
  protected readonly estadoLabels = GERENCIAMIENTO_VIAJE_ESTADO_LABELS;
  protected readonly estadoTone = ESTADO_TONE[this.gv.estado];
  protected readonly riesgoTone = RIESGO_TONE[this.gv.riskLevel];

  protected readonly generalItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    return [
      { label: 'Fecha', value: g.fecha },
      { label: 'Motivo del viaje', value: g.motivoViaje },
      { label: 'Origen', value: g.origen },
      { label: 'Destino', value: g.destino },
      { label: 'Ticket relacionado', value: g.ticketCode || '—' },
      { label: 'Vehículo', value: `${g.vehicleType} — ${g.placas}` },
    ];
  });

  protected readonly logisticaItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    return [
      { label: 'Pasajeros', value: g.passengers || '—' },
      { label: 'Hora de salida', value: g.departureTime || '—' },
      { label: 'Hora de llegada', value: g.arrivalTime || '—' },
      { label: 'Pernoctación', value: g.overnightData || '—' },
    ];
  });

  protected readonly aprobacionItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    if (g.estado === 'aprobado') {
      return [
        { label: 'Aprobado por', value: g.aprobadoPor || 'Sistema (riesgo BAJO)' },
        { label: 'Aprobado el', value: g.aprobadoAt ? new Date(g.aprobadoAt).toLocaleString('es-EC') : '—' },
      ];
    }
    if (g.estado === 'rechazado') {
      return [
        { label: 'Rechazado por', value: g.rechazadoPor || '—' },
        { label: 'Motivo', value: g.motivoRechazo || '—' },
      ];
    }
    return [{ label: 'Estado', value: 'Pendiente de autorización del Jefe de Base' }];
  });
}
