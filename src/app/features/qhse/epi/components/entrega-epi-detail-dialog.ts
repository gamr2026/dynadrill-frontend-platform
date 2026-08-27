import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { DynadrillContextCardComponent, DynadrillDataTableColumn, DynadrillDataTableComponent, type DynadrillContextCardItem } from '@digitec-it-projects/dynadrill-ui';
import { EntregaEpi } from '../models/entrega-epi.model';

export interface EntregaEpiDetailDialogData {
  entrega: EntregaEpi;
}

/** Detalle de solo lectura de una entrega de EPI (DYN-SGI-RE-032) — mismo patrón que VehicleInspectionDetailDialog/StopCardDetailDialog. */
@Component({
  selector: 'app-entrega-epi-detail-dialog',
  imports: [DynadrillContextCardComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrega-epi-detail-dialog.html',
  styleUrl: './entrega-epi-detail-dialog.scss',
})
export class EntregaEpiDetailDialog {
  private readonly data = inject<EntregaEpiDetailDialogData>(NZ_MODAL_DATA);

  protected readonly entrega = this.data.entrega;

  protected readonly generalItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.entrega;
    return [
      { label: 'Lugar', value: e.lugar },
      { label: 'Trabajador', value: e.trabajadorNombre },
      { label: 'Cargo', value: e.trabajadorCargo },
      { label: 'Trabajador firmó declaración', value: e.firmaTrabajador ? `${e.firmaTrabajador.nombre} — ${new Date(e.firmaTrabajador.firmadoAt).toLocaleString('es-EC')}` : 'Pendiente' },
      { label: 'Talento Humano — recibe conforme', value: e.firmaTalentoHumano ? `${e.firmaTalentoHumano.nombre} — ${new Date(e.firmaTalentoHumano.firmadoAt).toLocaleString('es-EC')}` : 'Pendiente' },
    ];
  });

  protected readonly itemsColumns: DynadrillDataTableColumn[] = [
    { key: 'elemento', header: 'Elemento' },
    { key: 'cantidad', header: 'Cantidad' },
    { key: 'talla', header: 'Talla' },
    { key: 'codigoOCedula', header: 'Código/Cédula' },
    { key: 'capacitacion', header: 'Capacitación' },
    { key: 'observaciones', header: 'Observaciones' },
  ];

  protected readonly itemsRows = computed(() =>
    this.entrega.items.map(i => ({
      elemento: i.elemento,
      cantidad: String(i.cantidad),
      talla: i.talla ?? '—',
      codigoOCedula: i.codigoOCedula ?? '—',
      capacitacion: i.recibioCapacitacion ? 'Sí' : 'No',
      observaciones: i.observaciones ?? '—',
    })),
  );
}
