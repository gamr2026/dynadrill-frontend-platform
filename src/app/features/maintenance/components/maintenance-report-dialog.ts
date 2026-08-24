import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { MaintenanceOrderWithSubOrders, SubOrderStatus } from '../models/maintenance-order.model';
import { unitReportCode, UnitReport } from '../models/unit-report.model';
import { RegistroMantenimiento } from '../models/historial-mantenimiento.model';

/**
 * DYN-MNT-RE-008 sirve tanto para el cierre correctivo (una orden con sus
 * sub-órdenes) como para un mantenimiento preventivo ejecutado (un único
 * registro de historial) — el formato físico trae ambas casillas. Fase 05.
 */
export type MaintenanceReportDialogData =
  | { clase: 'Correctivo'; order: MaintenanceOrderWithSubOrders; unitReport: UnitReport }
  | { clase: 'Preventivo'; registro: RegistroMantenimiento; unidadNombre: string };

const STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  'Pendiente': 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  'Cerrado': 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

@Component({
  selector: 'app-maintenance-report-dialog',
  imports: [DynadrillTextComponent, DynadrillButtonComponent, DynadrillCardComponent, DynadrillTagComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maintenance-report-dialog.html',
  styleUrl: './maintenance-report-dialog.scss',
})
export class MaintenanceReportDialog {
  protected readonly data = inject<MaintenanceReportDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<MaintenanceReportDialog>);
  protected readonly statusTone = STATUS_TONE;
  protected readonly unitReportCode = unitReportCode;

  /** Casillas del formato físico DYN-MNT-RE-008 — se marca la que aplica. */
  protected readonly tiposMantenimiento = ['Correctivo', 'Preventivo', 'Predictivo', 'Operativo'] as const;

  protected readonly printDate = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
