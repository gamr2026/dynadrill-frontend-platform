import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { EntregaEpi, EPI_ESTADO_LABELS } from '../models/entrega-epi.model';
import { EntregaEpiService } from '../services/entrega-epi.service';

export interface EntregaEpiDetailDialogData {
  entrega: EntregaEpi;
}

/**
 * Detalle de una entrega de EPI (DYN-SGI-RE-032). Acá vive "Recibe conforme
 * Talento Humano" — un archivo administrativo aparte del ciclo de
 * solicitar/aprobar/despachar (Fase 5): deja constancia de que Talento
 * Humano recibió el registro firmado para el file del trabajador (nota del
 * formato físico). No bloquea ni participa del flujo de aprobación/despacho.
 */
import { DocumentoPdfService } from '../../../../shared/documentos';
import { EntregaEpiHoja } from '../../../../shared/documentos/formatos/entrega-epi-hoja';

@Component({
  selector: 'app-entrega-epi-detail-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DatePipe, DynadrillContextCardComponent, DynadrillDataTableComponent, DynadrillTagComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrega-epi-detail-dialog.html',
  styleUrl: './entrega-epi-detail-dialog.scss',
})
export class EntregaEpiDetailDialog {
  private readonly data = inject<EntregaEpiDetailDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<EntregaEpiDetailDialog, EntregaEpi | undefined>);
  private readonly epiService = inject(EntregaEpiService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly documentoPdf = inject(DocumentoPdfService);

  protected readonly entrega = signal(this.data.entrega);
  protected readonly estadoLabels = EPI_ESTADO_LABELS;
  protected readonly submitting = signal(false);

  protected readonly generalItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.entrega();
    return [
      { label: 'Lugar', value: e.lugar },
      { label: 'Trabajador', value: e.trabajadorNombre },
      { label: 'Cargo', value: e.trabajadorCargo },
      { label: 'Trabajador firmó declaración', value: e.firmaTrabajador ? `${e.firmaTrabajador.nombre} — ${new Date(e.firmaTrabajador.firmadoAt).toLocaleString('es-EC')}` : 'Pendiente' },
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
    this.entrega().items.map(i => ({
      elemento: i.elemento,
      cantidad: String(i.cantidad),
      talla: i.talla ?? '—',
      codigoOCedula: i.codigoOCedula ?? '—',
      capacitacion: i.recibioCapacitacion ? 'Sí' : 'No',
      observaciones: i.observaciones ?? '—',
    })),
  );

  /** "Recibe conforme Talento Humano" — cierra el expediente administrativo (NOTA del formato físico), no el ciclo de aprobación/despacho. */
  protected recibirEnTalentoHumano(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    const nombre = this.auth.currentUser()?.name ?? '';
    this.epiService.update(this.entrega().id, { firmaTalentoHumano: { nombre, firmadoAt: new Date().toISOString() } }).subscribe({
      next: actualizada => {
        this.submitting.set(false);
        this.entrega.set(actualizada);
        this.notify.success('Recibido', 'Talento Humano recibió conforme — expediente archivado.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la recepción.');
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.entrega());
  }

  /** Formato DYN-SGI-RE-032 con quien recibe (trabajador) y quien entrega (QHSE / Talento Humano); se firma sobre el PDF. */
  protected verPdf(): void {
    const entrega = this.entrega();
    this.documentoPdf.abrir({
      titulo: `Entrega de EPI — ${entrega.code}`,
      component: EntregaEpiHoja,
      inputs: { entrega },
      orientacion: 'landscape',
      nombreArchivo: `Entrega de EPI ${entrega.code}`,
    });
  }
}
