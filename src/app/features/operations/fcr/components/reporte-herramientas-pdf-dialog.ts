import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { FCR_TOOL_DAILY_STATUS_CODE, FcrTicket, type FcrToolDailyStatus } from '../models/fcr.model';

export interface ReporteHerramientasPdfDialogData {
  ticket: FcrTicket;
}

interface ToolRow {
  toolId: number;
  name: string;
  cellsByDate: Partial<Record<string, string>>;
  counts: Record<FcrToolDailyStatus, number>;
  total: number;
}

/**
 * Vista imprimible del Reporte Diario de Herramientas en Renta
 * (DYN-FCR-RE-008) — matriz herramienta × día con el código de una letra
 * (O/S/D/V), igual que el documento real. Mismo patrón sin librería de
 * PDF: window.print().
 */
@Component({
  selector: 'app-reporte-herramientas-pdf-dialog',
  imports: [DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-herramientas-pdf-dialog.html',
  styleUrl: './reporte-herramientas-pdf-dialog.scss',
})
export class ReporteHerramientasPdfDialog {
  protected readonly data = inject<ReporteHerramientasPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<ReporteHerramientasPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  protected readonly dates = computed(() => [...new Set(this.data.ticket.toolUsageLog.map(e => e.date))].sort());

  protected readonly rows = computed<ToolRow[]>(() => {
    const t = this.data.ticket;
    return t.tools.map(tool => {
      const entries = t.toolUsageLog.filter(e => e.toolId === tool.id);
      const cellsByDate: Partial<Record<string, string>> = {};
      const counts: Record<FcrToolDailyStatus, number> = { operacion: 0, stand_by: 0, daily_charge: 0, venta: 0 };
      for (const entry of entries) {
        cellsByDate[entry.date] = FCR_TOOL_DAILY_STATUS_CODE[entry.status];
        counts[entry.status]++;
      }
      return { toolId: tool.id, name: tool.name, cellsByDate, counts, total: counts.operacion + counts.daily_charge + counts.venta };
    });
  });

  protected formatShort(iso: string): string {
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  }

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
