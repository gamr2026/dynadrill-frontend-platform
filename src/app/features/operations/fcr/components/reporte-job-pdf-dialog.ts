import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DecimalPipe } from '@angular/common';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { FcrTicket } from '../models/fcr.model';

export interface ReporteJobPdfDialogData {
  ticket: FcrTicket;
}

/**
 * Vista imprimible del Reporte Diario de Actividades de Operaciones
 * (DYN-SGI-RE-047) — mismo patrón que otq-pdf-dialog: sin librería de PDF,
 * el navegador resuelve "Guardar como PDF" con window.print().
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
    [...this.data.ticket.activityLog].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
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
