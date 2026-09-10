import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import type { OperativoDocHeader } from '../../models/operativo-docs.model';

/** Fila de la línea de tiempo — quién aprobó el avance de cada fase (independiente del enum `FcrPhase` para no acoplar `shared/` a `features/fcr`). */
export interface ReporteCierrePdfPhaseRow {
  label: string;
  approvedBy: string;
  approvedByRole: string;
  date: string;
}

export interface ReporteCierrePdfToolRow {
  id: number;
  name: string;
  status: string;
}

export interface ReporteCierrePdfDocumentRow {
  label: string;
  uploaded: boolean;
  nombreArchivo?: string;
}

export interface ReporteCierrePdfActivitySummaryRow {
  date: string;
  count: number;
  totalHours: number;
}

export interface ReporteCierrePdfDialogData {
  header: OperativoDocHeader;
  tipoOtLabel: string;
  estimatedDate: string;
  phases: ReporteCierrePdfPhaseRow[];
  tools: ReporteCierrePdfToolRow[];
  documentos: ReporteCierrePdfDocumentRow[];
  activitySummary: ReporteCierrePdfActivitySummaryRow[];
  totalHours: number;
  toolUsageCount: number;
  observationsCount: number;
}

/**
 * Vista imprimible del Resumen de Cierre de Ticket FCR — no es un formato
 * normado (a diferencia de DYN-SGI-RE-047 / DYN-FCR-RE-008), es un resumen
 * ejecutivo de todo lo realizado en el ticket para el cliente/archivo.
 * Mismo mecanismo que el resto de diálogos imprimibles: `window.print()` +
 * `@media print`, sin librería de PDF.
 */
@Component({
  selector: 'app-reporte-cierre-pdf-dialog',
  imports: [DecimalPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-cierre-pdf-dialog.html',
  styleUrl: './reporte-cierre-pdf-dialog.scss',
})
export class ReporteCierrePdfDialog {
  protected readonly data = inject<ReporteCierrePdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<ReporteCierrePdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  protected readonly documentsUploadedCount = computed(() => this.data.documentos.filter(d => d.uploaded).length);

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
