import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import autoTable from 'jspdf-autotable';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import type { OperativoActivityLogEntry, OperativoDocHeader } from '../../models/operativo-docs.model';
import { crearReportePdf, descargarReportePdf } from '../../utils/reporte-pdf.util';

export interface ReporteJobPdfDialogData {
  header: OperativoDocHeader;
  log: OperativoActivityLogEntry[];
}

/**
 * Vista imprimible del Reporte Diario de Actividades de Operaciones
 * (DYN-SGI-RE-047). Sin librería de PDF: `window.print()` + `@media print`.
 * Compartido entre FCR, Pumping y Facturación.
 */
@Component({
  selector: 'app-reporte-job-pdf-dialog',
  imports: [DecimalPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-job-pdf-dialog.html',
  styleUrl: './reporte-job-pdf-dialog.scss',
})
export class ReporteJobPdfDialog {
  protected readonly data = inject<ReporteJobPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<ReporteJobPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  protected readonly sortedLog = computed(() =>
    [...this.data.log].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
  );

  protected readonly totalHours = computed(() => this.sortedLog().reduce((sum, e) => sum + e.durationHours, 0));

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  print(): void {
    window.print();
  }

  /** Baja el PDF real (jsPDF) — a diferencia de `print()`, no depende de que el usuario elija "Guardar como PDF" en el diálogo de impresión del navegador. */
  descargarPdf(): void {
    const { doc, y } = crearReportePdf('Reporte Diario de Actividades de Operaciones', `DYN-SGI-RE-047 · Ticket ${this.data.header.code}`, this.data.header);
    const filas = this.sortedLog().map(e => [this.formatDate(e.date), e.startTime, e.endTime, e.durationHours.toFixed(2), e.detail, e.author]);
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Hora inicio', 'Hora fin', 'Horas', 'Detalle de actividades', 'Registrado por']],
      body: filas.length ? filas : [['Sin actividades registradas todavía.', '', '', '', '', '']],
      foot: [['Total de horas', '', '', this.totalHours().toFixed(2), '', '']],
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [45, 45, 60] },
      footStyles: { fillColor: [240, 240, 245], textColor: 30 },
      columnStyles: { 4: { cellWidth: 180 } },
    });
    descargarReportePdf(doc, `Reporte Job - ${this.data.header.code}.pdf`);
  }

  close(): void {
    this.modalRef.close();
  }
}
