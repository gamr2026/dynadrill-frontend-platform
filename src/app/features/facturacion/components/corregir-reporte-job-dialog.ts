import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { FcrService } from '../../operations/fcr/services/fcr.service';
import { PumpingService } from '../../operations/pumping/services/pumping.service';
import { ActividadTablasEditor } from '../../operations/pumping/components/actividad-tablas-editor';
import { limpiarTablas } from '../../../shared/utils/actividad-tablas';
import type { ActividadTabla } from '../../../shared/models/operativo-docs.model';
import { calcDurationHours, HOUR_OPTIONS, MINUTE_OPTIONS } from '../../../shared/utils';
import { fechaDoc } from '../../../shared/documentos/documento-format.util';
import type { DocumentoOperativo } from '../models/documento-operativo.model';
import { filaActividadValida, filasActividadValidas, type FilaActividad } from './corregir-reporte-job.util';

export interface CorregirReporteJobDialogData {
  /** Reporte Job de origen FCR o Pumping — trae `ticketOperativoId` y `fecha` del día a corregir. */
  doc: DocumentoOperativo;
}

/** `true` si se guardó la corrección (el Pedido debe recargar documentos y avance). */
export type CorregirReporteJobDialogResult = boolean;

interface FilaEditable extends FilaActividad {
  /** Clave estable para el `@for` — las filas no tienen id hasta que el backend las guarda. */
  key: number;
  /** Id de la actividad original (Pumping): conserva su autor al guardar. */
  id?: number;
  /** Tablas de la actividad (Pumping). */
  tablas?: ActividadTabla[];
}

/**
 * Facturación corrige el Reporte Job de un día (specs/fcr-bitacora-envio-diario):
 * edita, agrega y quita actividades de esa fecha. FCR: se guarda sobre la bitácora
 * del ticket (fuente única), así el Operador ve la misma corrección y el backend
 * regenera el Reporte Job del Pedido. Pumping: se edita el propio documento (con
 * las tablas de cada actividad) y Facturación tiene la última palabra — el ticket
 * ya no puede volver a enviar ese día.
 */
@Component({
  selector: 'app-corregir-reporte-job-dialog',
  imports: [
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillTextComponent,
    ActividadTablasEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './corregir-reporte-job-dialog.html',
  styleUrl: './corregir-reporte-job-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class CorregirReporteJobDialog {
  private readonly fcrService = inject(FcrService);
  private readonly pumpingService = inject(PumpingService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<CorregirReporteJobDialog, CorregirReporteJobDialogResult>);
  protected readonly data = inject<CorregirReporteJobDialogData>(NZ_MODAL_DATA);

  protected readonly hourOptions = HOUR_OPTIONS;
  protected readonly minuteOptions = MINUTE_OPTIONS;
  protected readonly fecha = fechaDoc(this.data.doc.fecha);
  protected readonly esPumping = this.data.doc.origen === 'pumping';

  private nextKey = 0;
  protected readonly filas = signal<FilaEditable[]>(
    [...(this.data.doc.actividades ?? [])]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(a => ({ key: this.nextKey++, id: a.id, startTime: a.startTime, endTime: a.endTime, detail: a.detail, tablas: a.tablas })),
  );

  protected readonly submitting = signal(false);
  protected readonly puedeGuardar = computed(() => filasActividadValidas(this.filas()) && !this.submitting());
  protected readonly totalHoras = computed(() =>
    Math.round(this.filas().filter(filaActividadValida).reduce((sum, f) => sum + calcDurationHours(f.startTime, f.endTime), 0) * 100) / 100,
  );

  protected readonly esValida = filaActividadValida;
  protected readonly duracion = (f: FilaActividad): string => (filaActividadValida(f) ? `${calcDurationHours(f.startTime, f.endTime)} h` : '—');
  protected readonly hora = (valor: string): string | null => valor.split(':')[0] || null;
  protected readonly minuto = (valor: string): string | null => valor.split(':')[1] || null;

  protected cambiarHora(key: number, campo: 'startTime' | 'endTime', parte: 'hora' | 'minuto', valor: string): void {
    this.actualizar(key, f => {
      const [h, m] = f[campo].split(':');
      return { ...f, [campo]: parte === 'hora' ? `${valor}:${m ?? '00'}` : `${h || '00'}:${valor}` };
    });
  }

  protected cambiarDetalle(key: number, detail: string): void {
    this.actualizar(key, f => ({ ...f, detail }));
  }

  protected cambiarTablas(key: number, tablas: ActividadTabla[]): void {
    this.actualizar(key, f => ({ ...f, tablas }));
  }

  protected agregarFila(): void {
    this.filas.update(filas => [...filas, { key: this.nextKey++, startTime: '', endTime: '', detail: '' }]);
  }

  protected quitarFila(key: number): void {
    this.filas.update(filas => filas.filter(f => f.key !== key));
  }

  protected async guardar(): Promise<void> {
    if (!this.puedeGuardar()) return;
    const { ticketOperativoId, fecha } = this.data.doc;
    if (!fecha) return;
    if (!this.filas().length) {
      const ok = await this.dialog.confirm({
        title: 'Dejar el día sin actividades',
        content: this.esPumping
          ? `El Reporte Job del ${this.fecha} se quitará del Pedido. ¿Continuar?`
          : `El Reporte Job del ${this.fecha} se quitará del Pedido y de la bitácora del ticket FCR. ¿Continuar?`,
        okText: 'Confirmar',
        cancelText: 'Cancelar',
        danger: true,
      });
      if (!ok) return;
    }

    this.submitting.set(true);
    const dia = fecha.slice(0, 10);
    const alGuardar = (): void => {
      this.notify.success(
        'Reporte Job corregido',
        this.esPumping ? `Se actualizó el día ${this.fecha} en el Pedido.` : `Se actualizó el día ${this.fecha} en el Pedido y en la bitácora FCR.`,
      );
      this.modalRef.close(true);
    };
    const alFallar = (err: HttpErrorResponse): void => {
      this.submitting.set(false);
      this.notify.error('Error', err.error?.message ?? 'No se pudo guardar la corrección.');
    };
    if (this.esPumping) {
      const actividadesPumping = this.filas().map(({ id, startTime, endTime, detail, tablas }) => {
        const limpias = limpiarTablas(tablas);
        return { ...(id != null ? { id } : {}), startTime, endTime, detail: detail.trim(), ...(limpias.length ? { tablas: limpias } : {}) };
      });
      this.pumpingService.corregirReporteJobDia(ticketOperativoId, dia, actividadesPumping).subscribe({ next: alGuardar, error: alFallar });
      return;
    }
    const actividades = this.filas().map(({ startTime, endTime, detail }) => ({ startTime, endTime, detail: detail.trim() }));
    this.fcrService.reemplazarDiaBitacora(ticketOperativoId, dia, actividades).subscribe({ next: alGuardar, error: alFallar });
  }

  protected cancelar(): void {
    this.modalRef.close(false);
  }

  private actualizar(key: number, cambio: (f: FilaEditable) => FilaEditable): void {
    this.filas.update(filas => filas.map(f => (f.key === key ? cambio(f) : f)));
  }
}
