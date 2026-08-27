import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { VehicleInspection } from '../models/vehicle-inspection.model';

export interface VehicleInspectionDetailDialogData {
  inspection: VehicleInspection;
}

/**
 * Detalle de solo lectura (DYN-SGI-RE-068) — a diferencia de
 * VehicleInspectionDialog (que SIEMPRE es un formulario editable, incluso
 * pasándole `existing`), esto nunca muestra un formulario ni un botón de
 * guardar. Pensado para el Jefe de Mantenimiento, que solo tiene
 * visibilidad de lo que Pumping ya llenó — no puede editarlo.
 */
@Component({
  selector: 'app-vehicle-inspection-detail-dialog',
  imports: [DynadrillContextCardComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-inspection-detail-dialog.html',
  styleUrl: './vehicle-inspection-detail-dialog.scss',
})
export class VehicleInspectionDetailDialog {
  private readonly data = inject<VehicleInspectionDetailDialogData>(NZ_MODAL_DATA);

  protected readonly insp = this.data.inspection;

  protected readonly generalItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.insp;
    return [
      { label: 'Unidad', value: i.unidadCode },
      { label: 'Fecha', value: i.fecha },
      { label: 'Punto de partida', value: i.puntoPartida },
      { label: 'Destino', value: i.destino || '—' },
      { label: 'Inspeccionado por', value: i.inspeccionadoPor },
      { label: 'Marca', value: i.marca },
      { label: 'Tipo', value: i.tipo },
      { label: 'Modelo', value: i.modelo },
      { label: 'Año', value: i.anioFabricacion },
      { label: 'Placa', value: i.placa },
      { label: 'Km inicial', value: String(i.kmInicial) },
      { label: 'Km final', value: String(i.kmFinal) },
    ];
  });

  protected readonly documentosItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.insp;
    const items: DynadrillContextCardItem[] = [];
    if (i.fechaMatricula) items.push({ label: 'Fecha matrícula', value: i.fechaMatricula });
    if (i.caducidadMatricula) items.push({ label: 'Caducidad matrícula', value: i.caducidadMatricula });
    if (i.caducidadPoliza) items.push({ label: 'Caducidad póliza', value: i.caducidadPoliza });
    if (i.vigenciaOtroDocumento) items.push({ label: 'Otro documento', value: i.vigenciaOtroDocumento });
    if (i.proximoMantenimiento) items.push({ label: 'Próximo mantenimiento', value: i.proximoMantenimiento });
    return items;
  });

  protected readonly checklistColumns: DynadrillDataTableColumn[] = [
    { key: 'label', header: 'Ítem' },
    { key: 'estado', header: 'Estado' },
  ];

  private static estadoLabel(estado: VehicleInspection['checklistVehiculo'][number]['estado']): string {
    return estado === 'C' ? 'Cumple' : estado === 'NC' ? 'No cumple' : estado === 'NA' ? 'N/A' : '—';
  }

  protected readonly vehiculoRows = computed(() =>
    this.insp.checklistVehiculo.map(item => ({ label: item.label, estado: VehicleInspectionDetailDialog.estadoLabel(item.estado) })),
  );

  protected readonly equipoRows = computed(() =>
    this.insp.checklistEquipo.map(item => ({ label: item.label, estado: VehicleInspectionDetailDialog.estadoLabel(item.estado) })),
  );

  protected readonly conductorItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.insp;
    return [
      { label: 'Licencia vigente', value: i.licenciaVigente ? 'Sí' : 'No' },
      { label: 'Manejo defensivo vigente', value: i.manejoDefensivoVigente ? 'Sí' : 'No' },
      { label: 'Examen médico vigente', value: i.examenMedicoVigente ? 'Sí' : 'No' },
      { label: 'Examen psicosensométrico', value: i.examenPsicosensometrico ? 'Sí' : 'No' },
      { label: 'Documentos de clientes', value: i.documentosClientes ? 'Sí' : 'No' },
      { label: 'Vacunas/certificado', value: i.vacunasCertificado ? 'Sí' : 'No' },
      { label: 'Reúne condiciones para trabajar', value: i.reuneCondicionesParaTrabajar ? 'Sí' : 'No' },
    ];
  });

  protected readonly aprobacionItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.insp;
    return [
      { label: 'Supervisor', value: i.supervisorNombre || '—' },
      { label: 'Aprobación', value: i.supervisorApprovedBy ? `Aprobado por ${i.supervisorApprovedBy}` : 'Pendiente' },
      { label: 'Fecha de aprobación', value: i.supervisorApprovedAt || '—' },
    ];
  });
}
