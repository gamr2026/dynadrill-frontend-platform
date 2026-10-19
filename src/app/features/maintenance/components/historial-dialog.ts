import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { forkJoin } from 'rxjs';
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
import { FlotaUnidadesService } from '../../flota/services/flota-unidades.service';
import { registroDesdePreventivo } from '../models/flota-mantenimiento.mapper';
import { DocumentoPdfService } from '../../../shared/documentos';
import { InformeMantenimientoHoja } from '../../../shared/documentos/formatos/informe-mantenimiento-hoja';

export interface HistorialDialogData {
  /** Id de la unidad en la demo (número); con `unidadFlotaId` no se usa. */
  unidadId: number | string;
  /** Si viene, el historial sale de Flota (UUID de la unidad) en lugar de la demo. */
  unidadFlotaId?: string;
  unidadCode: string;
  unidadNombre: string;
}

const CLASE_TONE: Record<RegistroMantenimiento['clase'], DynadrillTagVariant> = {
  Preventivo: 'success',
  Correctivo: 'warning',
};

@Component({
  selector: 'app-historial-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillTagComponent, DynadrillCardComponent, DynadrillSpinnerComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historial-dialog.html',
  styleUrl: './historial-dialog.scss',
})
export class HistorialDialog {
  protected readonly data = inject<HistorialDialogData>(NZ_MODAL_DATA);
  private readonly historialService = inject(HistorialMantenimientoService);
  private readonly flota = inject(FlotaUnidadesService);
  private readonly dialogService = inject(DynadrillDialogService);

  protected readonly claseTone = CLASE_TONE;
  protected readonly loading = signal(true);
  protected readonly registros = signal<RegistroMantenimiento[]>([]);

  constructor() {
    const flotaId = this.data.unidadFlotaId;
    if (flotaId) {
      forkJoin({ unidad: this.flota.obtener(flotaId), preventivos: this.flota.preventivos(flotaId) }).subscribe({
        next: ({ unidad, preventivos }) => {
          this.registros.set(preventivos.map(p => registroDesdePreventivo(p, unidad)));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }
    this.historialService.list(Number(this.data.unidadId)).subscribe(registros => {
      this.registros.set(registros);
      this.loading.set(false);
    });
  }

  /** Solo los registros preventivos abren el informe desde acá — los correctivos ya lo tienen desde la bandeja (orden cerrada). */
  private readonly documentoPdf = inject(DocumentoPdfService);

  printInforme(registro: RegistroMantenimiento): void {
    this.documentoPdf.abrir({
      titulo: `Informe DYN-MNT-RE-008 — ${registro.unidadCode}`,
      component: InformeMantenimientoHoja,
      inputs: { datos: { clase: 'Preventivo', registro, unidadNombre: this.data.unidadNombre } },
      nombreArchivo: `Informe de mantenimiento ${registro.unidadCode} ${registro.fecha}`,
    });
  }
}
