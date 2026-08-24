import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { RegistroMantenimiento } from '../models/historial-mantenimiento.model';
import { HistorialMantenimientoService } from '../services/historial-mantenimiento.service';
import { MaintenanceReportDialog, MaintenanceReportDialogData } from './maintenance-report-dialog';

export interface HistorialDialogData {
  unidadId: number;
  unidadCode: string;
  unidadNombre: string;
}

const CLASE_TONE: Record<RegistroMantenimiento['clase'], DynadrillTagVariant> = {
  Preventivo: 'success',
  Correctivo: 'warning',
};

@Component({
  selector: 'app-historial-dialog',
  imports: [DynadrillTextComponent, DynadrillTagComponent, DynadrillCardComponent, DynadrillSpinnerComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historial-dialog.html',
  styleUrl: './historial-dialog.scss',
})
export class HistorialDialog {
  protected readonly data = inject<HistorialDialogData>(NZ_MODAL_DATA);
  private readonly historialService = inject(HistorialMantenimientoService);
  private readonly dialogService = inject(DynadrillDialogService);

  protected readonly claseTone = CLASE_TONE;
  protected readonly loading = signal(true);
  protected readonly registros = signal<RegistroMantenimiento[]>([]);

  constructor() {
    this.historialService.list(this.data.unidadId).subscribe(registros => {
      this.registros.set(registros);
      this.loading.set(false);
    });
  }

  /** Solo los registros preventivos abren el informe desde acá — los correctivos ya lo tienen desde la bandeja (orden cerrada). */
  printInforme(registro: RegistroMantenimiento): void {
    this.dialogService.open<MaintenanceReportDialog, MaintenanceReportDialogData>({
      title: `Informe DYN-MNT-RE-008 — ${registro.unidadCode}`,
      content: MaintenanceReportDialog,
      data: { clase: 'Preventivo', registro, unidadNombre: this.data.unidadNombre },
      footer: false,
      width: '780px',
    });
  }
}
