import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import * as XLSX from 'xlsx';
import { DynadrillButtonComponent, DynadrillDialogService, DynadrillIconButtonComponent, DynadrillNotificationService, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { DocumentoOperativo } from '../../../facturacion/models/documento-operativo.model';
import { ReporteJobPdfDialog, ReporteJobPdfDialogData } from '../../../../shared/index';
import { PumpingDocumento, PumpingService } from '../services/pumping.service';

export interface TicketDocumentosDialogData {
  ticketId: number;
  ticketCode: string;
  /** Ya filtrados a este ticket (tipo 'reporte_job') — ver ticket-list-page.ts. */
  reporteJobDocs: DocumentoOperativo[];
}

/**
 * "Al finalizar, que se puedan ver los documentos generados (Job Log,
 * inspecciones de vehículo y demás)" — Job Log (Reporte Job) + documentos
 * subidos a disco (ej. monitoreo). Las inspecciones de vehículo siguen sin
 * poder listarse por ticket (no guardan a qué ticket de Pumping pertenecen,
 * solo el código de unidad).
 */
@Component({
  selector: 'app-ticket-documentos-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillButtonComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-documentos-dialog.html',
  styleUrl: './ticket-documentos-dialog.scss',
})
export class TicketDocumentosDialog {
  private readonly dialog = inject(DynadrillDialogService);
  private readonly pumpingService = inject(PumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketDocumentosDialog>);
  protected readonly data = inject<TicketDocumentosDialogData>(NZ_MODAL_DATA);

  protected readonly documentosSubidos = signal<PumpingDocumento[]>([]);
  protected readonly loadingDocumentos = signal(true);

  constructor() {
    this.pumpingService.listarDocumentos(this.data.ticketId).subscribe({
      next: docs => {
        this.documentosSubidos.set(docs);
        this.loadingDocumentos.set(false);
      },
      error: () => this.loadingDocumentos.set(false),
    });
  }

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

  /** Blob autenticado (Bearer vía HttpClient) — un `<a href>` directo al endpoint no lo llevaría. */
  protected descargarDocumento(doc: PumpingDocumento): void {
    this.pumpingService.descargarDocumento(this.data.ticketId, doc.campo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nombreOriginal;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo descargar el documento.'),
    });
  }

  /**
   * Excel con el contenido del Reporte diario de actividades hecho hasta el
   * momento (uno o más `reporte_job`, un día por fila de actividad) — antes
   * solo se podía "Ver PDF" día por día, sin poder llevarse todo el
   * contenido junto.
   */
  protected descargarExcelReporteDiario(): void {
    const filas = this.data.reporteJobDocs
      .filter(d => d.actividades?.length)
      .flatMap(d => d.actividades!.map(a => ({
        Fecha: a.date,
        Inicio: a.startTime,
        Fin: a.endTime,
        'Horas': a.durationHours,
        Detalle: a.detail,
        Autor: a.author,
        'Firmado por': d.firmadoPor ?? '',
      })));
    if (!filas.length) {
      this.notify.error('Sin datos', 'Todavía no hay actividades registradas en el Reporte diario de este ticket.');
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(filas);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Reporte diario');
    XLSX.writeFile(book, `Reporte-diario-${this.data.ticketCode}.xlsx`);
  }

  protected cerrar(): void {
    this.modalRef.close();
  }
}
