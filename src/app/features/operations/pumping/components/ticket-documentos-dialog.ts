import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillDialogService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { DocumentoOperativo } from '../../../facturacion/models/documento-operativo.model';
import { ReporteJobPdfDialog, ReporteJobPdfDialogData } from '../../../../shared/index';

export interface TicketDocumentosDialogData {
  ticketCode: string;
  /** Ya filtrados a este ticket (tipo 'reporte_job') — ver ticket-list-page.ts. */
  reporteJobDocs: DocumentoOperativo[];
}

/**
 * "Al finalizar, que se puedan ver los documentos generados (Job Log,
 * inspecciones de vehículo y demás)" — por ahora solo Job Log: las
 * inspecciones de vehículo no guardan a qué ticket de Pumping pertenecen
 * (solo el código de unidad), así que no se pueden listar de forma
 * confiable por ticket todavía (requiere agregar ese vínculo primero).
 */
@Component({
  selector: 'app-ticket-documentos-dialog',
  imports: [DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-documentos-dialog.html',
  styleUrl: './ticket-documentos-dialog.scss',
})
export class TicketDocumentosDialog {
  private readonly dialog = inject(DynadrillDialogService);
  private readonly modalRef = inject(NzModalRef<TicketDocumentosDialog>);
  protected readonly data = inject<TicketDocumentosDialogData>(NZ_MODAL_DATA);

  protected verReporteJob(doc: DocumentoOperativo): void {
    if (!doc.header || !doc.actividades) return;
    this.dialog.open<ReporteJobPdfDialog, ReporteJobPdfDialogData>({
      title: `Reporte Job — ${doc.fecha ?? ''}`,
      content: ReporteJobPdfDialog,
      data: { header: doc.header, log: doc.actividades },
      footer: false,
      width: '820px',
    });
  }

  protected cerrar(): void {
    this.modalRef.close();
  }
}
