import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import type { OperativoActivityLogEntry, OperativoDocHeader } from '../../models/operativo-docs.model';

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

  close(): void {
    this.modalRef.close();
  }
}
