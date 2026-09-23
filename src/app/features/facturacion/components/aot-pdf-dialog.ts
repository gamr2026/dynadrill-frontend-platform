import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { Aot } from '../models/aot.model';

const MARGIN_X = 40;
const PAGE_WIDTH = 595; // A4 en pt

export interface AotPdfDialogData {
  aot: Aot;
}

/**
 * Vista imprimible de la AOT — "ORDEN DE TRABAJO / RESUMEN DE COSTOS",
 * formato de la pestaña OTQ de `COMP. 4130`. Firmas físicas.
 */
@Component({
  selector: 'app-aot-pdf-dialog',
  imports: [DecimalPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aot-pdf-dialog.html',
  styleUrl: './aot-pdf-dialog.scss',
})
export class AotPdfDialog {
  protected readonly data = inject<AotPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<AotPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  print(): void {
    window.print();
  }

  /**
   * Baja el PDF real (jsPDF) — mismo formato que la vista de impresión
   * (`aot-pdf-dialog.html`, verificado 1:1 contra `COMP. 4130`), sin
   * depender de que el usuario elija "Guardar como PDF" en el navegador.
   * Sin logo de cliente por ahora (AOT aplica a varios clientes, cada uno
   * con el suyo — se agrega cuando estén los archivos de cada logo).
   */
  descargarPdf(): void {
    const { aot } = this.data;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const contentWidth = PAGE_WIDTH - MARGIN_X * 2;
    const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let y = 36;

    // Título — 3 celdas bordeadas (logo / título / celda vacía), igual que el original.
    autoTable(doc, {
      startY: y,
      body: [['', 'ORDEN DE TRABAJO\nRESUMEN DE COSTOS', '']],
      theme: 'grid',
      styles: { fontSize: 12, cellPadding: 10, textColor: 20, lineColor: 60, lineWidth: 0.75, halign: 'center', valign: 'middle', fontStyle: 'bold', minCellHeight: 44 },
      columnStyles: { 0: { cellWidth: contentWidth * 0.18 }, 1: { cellWidth: contentWidth * 0.64 }, 2: { cellWidth: contentWidth * 0.18 } },
    });
    y = finalY();

    // Cabecera CONTRATISTA/No./FECHA — tabla con bordes (es literalmente una
    // hoja de cálculo impresa, ver comentario de `Aot`), no cajas sueltas.
    autoTable(doc, {
      startY: y,
      body: [
        [`CONTRATISTA: DYNADRILL ECUADOR C.A.`, `No. :  ${aot.numeroOpr}`, ''],
        [aot.contratoTexto, `FECHA:  ${aot.fecha}`, 'Página 1 de 1'],
      ],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 6, textColor: 30, lineColor: 60, lineWidth: 0.75, valign: 'top' },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.56 },
        1: { cellWidth: contentWidth * 0.26, fontStyle: 'bold' },
        2: { cellWidth: contentWidth * 0.18 },
      },
      didParseCell: cell => {
        if (cell.row.index === 0) cell.cell.styles.fontStyle = 'bold';
      },
    });
    y = finalY();

    // Descripción del Requerimiento — etiqueta subrayada + Nota a la derecha, misma fila.
    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, y + 14, MARGIN_X + 260, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.text('Descripción del Requerimiento o de la Orden de Trabajo', MARGIN_X, y + 11);
    doc.setFont('helvetica', 'italic');
    doc.text('NOTA: No inicie actividades sin información previa', PAGE_WIDTH - MARGIN_X, y + 11, { align: 'right' });
    y += 20;

    // SERVICIO — fila bordeada, mismo ancho que la tabla principal.
    autoTable(doc, {
      startY: y,
      body: [[`SERVICIO:  ${aot.servicio}`]],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 6, textColor: 20, lineColor: 60, lineWidth: 0.75, fontStyle: 'bold' },
    });
    y = finalY() + 10;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(
      `Las tarifas serán las del Contrato ${aot.numeroContrato}, las mismas que serán incluidas en la presente hoja de costos estimados.`,
      MARGIN_X,
      y,
    );
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['CÓDIGO', 'SERVICIOS REQUERIDOS', 'UNIDAD', 'TARIFA UNITARIA', 'CANTIDAD', 'TOTAL']],
      body: aot.detalle.map(it => [
        it.codigo,
        it.servicioRequerido,
        it.unidad,
        it.tarifaUnitaria.toFixed(2),
        it.cantidad.toFixed(2),
        it.total.toFixed(2),
      ]),
      foot: [['Valor de la OT:', '', '', '', '', aot.valorOt.toFixed(2)]],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 5, lineColor: 60, lineWidth: 0.75 },
      headStyles: { fillColor: [235, 235, 240], textColor: 20, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: 255, textColor: 20, fontStyle: 'bold', halign: 'right' },
      columnStyles: { 1: { cellWidth: 160 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
    y = finalY() + 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30);
    doc.text(`Fecha de Inicio:      ${aot.fechaInicio || '—'}`, MARGIN_X, y);
    doc.text(`Fecha de Terminación:      ${aot.fechaTerminacion || '—'}`, MARGIN_X + 220, y);
    y += 40;

    // Firmas — tabla con bordes: encabezado (uno por columna) + fila de firma en blanco + Nombre + Cargo.
    autoTable(doc, {
      startY: y,
      body: [
        ['REPRESENTANTE DE LA CONTRATISTA', 'REPRESENTANTE DE EP PETROECUADOR'],
        ['', ''],
        [`Nombre:  ${aot.representanteContratista.nombre}`, `Nombre:  ${aot.representanteCliente.nombre}`],
        [`Cargo:  ${aot.representanteContratista.cargo}`, `Cargo:  ${aot.representanteCliente.cargo}`],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 6, textColor: 30, lineColor: 60, lineWidth: 0.75, halign: 'center' },
      columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
      didParseCell: cell => {
        if (cell.row.index === 0) cell.cell.styles.fontStyle = 'bold';
        if (cell.row.index === 1) cell.cell.styles.minCellHeight = 34;
      },
    });
    y = finalY() + 20;

    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(`Impresión: ${this.printDate} · Estado: ${aot.estado}`, MARGIN_X, doc.internal.pageSize.getHeight() - 24);

    doc.save(`AOT ${aot.numeroOpr}.pdf`);
  }

  close(): void {
    this.modalRef.close();
  }
}
