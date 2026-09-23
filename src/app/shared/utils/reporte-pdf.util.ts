import { jsPDF } from 'jspdf';
import type { OperativoDocHeader } from '../models/operativo-docs.model';

const MARGIN_X = 40;
const PAGE_WIDTH = 595; // A4 en pt (jsPDF unit: 'pt')

/**
 * Membrete + título + campos de cabecera, en jsPDF puro — mismo contenido
 * que el letterhead HTML de `reporte-job-pdf-dialog`/`reporte-herramientas-pdf-dialog`
 * (esos siguen usando `window.print()` para "Imprimir"; esto es para el
 * botón "Descargar PDF" nuevo, que baja el archivo real sin pasar por el
 * diálogo de impresión del navegador).
 */
export function crearReportePdf(titulo: string, subtitulo: string, header: OperativoDocHeader): { doc: jsPDF; y: number } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Dynadrill Ecuador C.A.', MARGIN_X, 40);
  doc.text(`Fecha de impresión: ${printDate}`, PAGE_WIDTH - MARGIN_X, 40, { align: 'right' });

  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(titulo, MARGIN_X, 68);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(subtitulo, MARGIN_X, 84);

  doc.setDrawColor(220);
  doc.line(MARGIN_X, 96, PAGE_WIDTH - MARGIN_X, 96);

  const campos: [string, string][] = [
    ['Cliente', header.cliente],
    ['Pozo', header.pozo],
    ['Supervisor', header.supervisor || '—'],
    ['Operador', header.operador || '—'],
  ];
  let x = MARGIN_X;
  const colWidth = (PAGE_WIDTH - MARGIN_X * 2) / 4;
  for (const [label, value] of campos) {
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(label, x, 116);
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(value, x, 130, { maxWidth: colWidth - 8 });
    x += colWidth;
  }

  return { doc, y: 156 };
}

/** Pie de página + guardado — mismo texto que el footer HTML. */
export function descargarReportePdf(doc: jsPDF, nombreArchivo: string): void {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text('Documento generado electrónicamente por el Sistema de Gestión Dynadrill.', MARGIN_X, doc.internal.pageSize.getHeight() - 24);
  }
  doc.save(nombreArchivo);
}

export { MARGIN_X, PAGE_WIDTH };
