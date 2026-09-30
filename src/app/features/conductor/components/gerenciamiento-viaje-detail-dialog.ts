import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillContextCardComponent, DynadrillTagComponent, type DynadrillContextCardItem, type DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';
import {
  GERENCIAMIENTO_VIAJE_ESTADO_LABELS,
  GERENCIAMIENTO_VIAJE_TIPO_LABELS,
  GerenciamientoViaje,
  GerenciamientoViajeEstado,
} from '../models/gerenciamiento-viaje.model';
import { DocumentoPdfService } from '../../../shared/documentos';
import { GerenciamientoViajeHoja } from '../../../shared/documentos/formatos/gerenciamiento-viaje-hoja';

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
  imports: [DynadrillButtonComponent, DynadrillContextCardComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamiento-viaje-detail-dialog.html',
  styleUrl: './gerenciamiento-viaje-detail-dialog.scss',
})
export class GerenciamientoViajeDetailDialog {
  private readonly data = inject<GerenciamientoViajeDetailDialogData>(NZ_MODAL_DATA);
  private readonly documentoPdf = inject(DocumentoPdfService);

  protected readonly gv = this.data.gv;
  protected readonly estadoLabels = GERENCIAMIENTO_VIAJE_ESTADO_LABELS;
  protected readonly tipoLabels = GERENCIAMIENTO_VIAJE_TIPO_LABELS;
  protected readonly estadoTone = ESTADO_TONE[this.gv.estado];
  protected readonly riesgoTone = RIESGO_TONE[this.gv.riskLevel];

  protected readonly generalItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    return [
      { label: 'Tipo', value: this.tipoLabels[g.tipo] },
      { label: 'Fecha', value: g.fecha },
      { label: 'Motivo del viaje', value: g.motivoViaje },
      { label: 'Línea de servicio', value: g.lineaServicio || '—' },
      { label: 'Origen', value: g.origen },
      { label: 'Destino', value: g.destino },
      { label: 'Supervisor asignado', value: g.assignedSupervisorNombre || '—' },
      { label: 'Ticket relacionado', value: g.ticketCode || '—' },
      { label: 'Vehículo', value: `${g.vehicleType} — ${g.placas}` },
    ];
  });

  protected readonly logisticaItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    const ruta = g.routeInfo?.[0];
    const comunicacion = g.communication?.[0];
    return [
      { label: 'Pasajeros', value: g.passengers || '—' },
      { label: '¿Combina viajes?', value: g.canCombineTrips === true ? 'Sí' : g.canCombineTrips === false ? 'No' : '—' },
      { label: 'Locación de ruta', value: ruta?.location || '—' },
      { label: 'Hora de salida', value: g.departureTime || '—' },
      { label: 'Hora de llegada', value: g.arrivalTime || '—' },
      { label: 'Pernoctación', value: g.overnightData || '—' },
      { label: 'Frecuencia de contacto', value: comunicacion?.frequency || '—' },
      { label: 'Persona de contacto', value: comunicacion?.contactPerson || '—' },
      { label: 'Detalles de contacto', value: comunicacion?.contactDetails || '—' },
    ];
  });

  protected readonly aprobacionItems = computed<DynadrillContextCardItem[]>(() => {
    const g = this.gv;
    if (g.estado === 'aprobado') {
      return [
        { label: 'Aprobado por', value: g.aprobadoPor || '—' },
        { label: 'Aprobado el', value: g.aprobadoAt ? new Date(g.aprobadoAt).toLocaleString('es-EC') : '—' },
      ];
    }
    if (g.estado === 'rechazado') {
      return [
        { label: 'Rechazado por', value: g.rechazadoPor || '—' },
        { label: 'Motivo', value: g.motivoRechazo || '—' },
      ];
    }
    const revisor = g.riskLevel === 'BAJO' ? 'del Supervisor de Pumping' : 'del Jefe de Base o Gerente HSE';
    return [{ label: 'Estado', value: `Pendiente de autorización ${revisor}` }];
  });

  /** Formato DYN-SGI-RE-049: con los nombres del conductor y de quien autorizó; la firma se hace sobre el PDF. */
  protected verPdf(): void {
    this.documentoPdf.abrir({
      titulo: `Gerenciamiento de Viaje — ${this.gv.code}`,
      component: GerenciamientoViajeHoja,
      inputs: { gv: this.gv },
      nombreArchivo: `Gerenciamiento de Viaje ${this.gv.code}`,
    });
  }
}
