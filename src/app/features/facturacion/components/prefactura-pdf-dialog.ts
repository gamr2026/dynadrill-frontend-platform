import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { Prefactura } from '../models/prefactura.model';
import { Pedido, itemsEstimadosDe } from '../models/pedido.model';

const MARGIN_X = 40;
const PAGE_WIDTH = 595;

export interface PrefacturaPdfDialogData {
  prefactura: Prefactura;
  pedido: Pedido;
}

/** Condiciones de servicio fijas — mismo texto de la plantilla real DYN-AFN-RE-11B. */
const CONDICIONES_SERVICIO =
  'Los daños totales o parciales de equipos y/o herramientas, días de espera, equipos y personal, suspensión de ' +
  'trabajo o demás situaciones que pudieran presentarse durante la operación, estarán sujetas a los términos y ' +
  'condiciones del contrato bajo el cual se oferta el presente servicio.';

/**
 * Vista imprimible de la Prefactura — formato `DYN-AFN-RE-11B` (réplica del
 * Excel real: cabecera con nº de ticket destacado, condiciones de servicio,
 * detalle con columnas Tipo/Material/Servicio, "los precios no incluyen
 * IVA" y firma electrónica). Sin librería de PDF: `window.print()`.
 */
@Component({
  selector: 'app-prefactura-pdf-dialog',
  imports: [DecimalPipe, DatePipe, UpperCasePipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-pdf-dialog.html',
  styleUrl: './prefactura-pdf-dialog.scss',
})
export class PrefacturaPdfDialog {
  protected readonly data = inject<PrefacturaPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<PrefacturaPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  protected readonly condicionesServicio = CONDICIONES_SERVICIO;

  protected readonly esVerbal = computed(() => this.data.pedido.solicitudMedio === 'verbal');

  /** Descripción(es) de las líneas estimadas — texto de observaciones del PDF. */
  protected readonly observaciones = computed(() =>
    itemsEstimadosDe(this.data.pedido)
      .map(i => i.descripcion)
      .filter(Boolean)
      .join(' · '),
  );

  print(): void {
    window.print();
  }

  /** Baja el PDF real (jsPDF) — mismo formato DYN-AFN-RE-11B que la vista de impresión, en tablas con bordes (ver aot-pdf-dialog.ts). */
  descargarPdf(): void {
    const { prefactura: pf, pedido: p } = this.data;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const contentWidth = PAGE_WIDTH - MARGIN_X * 2;
    const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let y = 36;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20);
    doc.text('DYNADRILL', MARGIN_X, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Vía Coca Lago Km 2, Orellana - Ecuador · dynadrillecuador@dynadrill.com.ec', MARGIN_X, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20);
    doc.text('PREFACTURA', PAGE_WIDTH / 2, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('DYN-AFN-RE-11B · Versión: 02', PAGE_WIDTH - MARGIN_X, y, { align: 'right' });
    y += 26;

    autoTable(doc, {
      startY: y,
      body: [
        [`FECHA: ${new Date(pf.fechaGeneracion).toLocaleDateString('es-EC')}`, `CLIENTE: ${p.cliente}`, `Nº ${p.code}`],
        [`CONTRATO: ${p.numeroContrato}`, `SOLICITADO POR: ${p.representanteCampo}`, ''],
        [`INICIO: ${p.fechaInicioServicio || '—'}`, `TERMINADO: ${p.fechaFinServicio || '—'}`, ''],
      ],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 5, textColor: 30, lineColor: 60, lineWidth: 0.75 },
      columnStyles: { 0: { cellWidth: contentWidth * 0.32 }, 1: { cellWidth: contentWidth * 0.38 }, 2: { cellWidth: contentWidth * 0.3, fontStyle: 'bold', fontSize: 11, halign: 'center', valign: 'middle' } },
      didParseCell: cell => {
        if (cell.column.index === 2 && cell.row.index > 0) cell.cell.styles.lineWidth = 0;
      },
    });
    y = finalY();

    autoTable(doc, {
      startY: y,
      body: [[`CAMPO/BLOQUE: ${p.campo} / BLOQUE ${p.bloque}`, `POZO: ${p.pozo}`, `TALADRO: ${p.taladroRig}`]],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 5, textColor: 30, lineColor: 60, lineWidth: 0.75 },
    });
    y = finalY() + 14;

    const items = itemsEstimadosDe(p);
    const observaciones = items.map(i => i.descripcion).filter(Boolean).join(' · ');
    if (observaciones) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90);
      const lineas = doc.splitTextToSize(`OBSERVACIONES: ${observaciones}`, contentWidth);
      doc.text(lineas, MARGIN_X, y);
      y += lineas.length * 10 + 10;
    }

    autoTable(doc, {
      startY: y,
      head: [['Ítem', 'Código', 'Cant.', 'Unidad', 'Serie', 'Descripción', 'P. Unit.', 'P. Total', 'Tipo']],
      body: pf.items.map((it, i) => [
        String(i + 1),
        it.codigo,
        String(it.cantidad),
        it.unidad,
        it.serie || '—',
        it.descripcion,
        it.precioUnitario.toFixed(2),
        it.precioTotal.toFixed(2),
        it.tipo,
      ]),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 4, lineColor: 60, lineWidth: 0.75 },
      headStyles: { fillColor: [235, 235, 240], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 5: { cellWidth: 130 }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    });
    y = finalY() + 8;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text('Los precios no incluyen IVA.', MARGIN_X, y);
    y += 14;

    autoTable(doc, {
      startY: y,
      body: [
        ['Subtotal Materiales', pf.subtotalMateriales.toFixed(2)],
        ['Subtotal Servicios', pf.subtotalServicios.toFixed(2)],
        ['SUBTOTAL', pf.subtotal.toFixed(2)],
        ['IVA (15%)', pf.iva.toFixed(2)],
        ['Retención IR (1%)', `-${pf.retencionIR.toFixed(2)}`],
        ['Retención IVA (30%)', `-${pf.retencionIVA.toFixed(2)}`],
        ['TOTAL', pf.netoCobrar.toFixed(2)],
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 5, lineColor: 60, lineWidth: 0.75 },
      columnStyles: { 0: { cellWidth: 160 }, 1: { halign: 'right', cellWidth: 100 } },
      margin: { left: PAGE_WIDTH - MARGIN_X - 260 },
      didParseCell: cell => {
        if (cell.row.index === 2 || cell.row.index === 6) cell.cell.styles.fontStyle = 'bold';
      },
    });
    y = finalY() + 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text(`Firma electrónica autorizada por Dynadrill Ecuador C.A.: ${pf.generadoPor || '—'}`, MARGIN_X, y);
    y += 12;
    if (pf.firmaCliente) {
      doc.text(
        `Firma del cliente: ${pf.firmaCliente.nombre} · ${pf.firmaCliente.cargo} · ${new Date(pf.firmaCliente.firmadoAt).toLocaleString('es-EC')}`,
        MARGIN_X,
        y,
      );
    }

    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(
      `Impresión: ${this.printDate} · Nº ${pf.code} · Estado: ${pf.estado.toUpperCase()}`,
      MARGIN_X,
      doc.internal.pageSize.getHeight() - 24,
    );

    doc.save(`Prefactura ${pf.code}.pdf`);
  }

  close(): void {
    this.modalRef.close();
  }
}
