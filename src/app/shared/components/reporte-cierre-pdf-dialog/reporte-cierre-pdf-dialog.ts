import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { imprimirDocumento } from '../../documentos/imprimir.util';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DuracionPipe } from '../../pipes/duracion.pipe';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import type { OperativoDocHeader } from '../../models/operativo-docs.model';

/**
 * Fila de la línea de tiempo — mismos datos que la tarjeta del avance del ticket
 * (`timelineResumen.tramos`): quién, con qué rol, cuándo empezó y terminó cada
 * fase y cuánto duró. Independiente del enum `FcrPhase` para no acoplar `shared/` a `features/fcr`.
 */
export interface ReporteCierrePdfPhaseRow {
  label: string;
  /** Nombre de la persona (no el correo: es accountability interna, igual que en la tarjeta del avance). */
  responsable: string;
  rol: string;
  /** ISO con hora. */
  inicio: string;
  /** ISO con hora; ausente = fase sin finalizar. */
  fin?: string;
  duracionMs?: number;
}

export interface ReporteCierrePdfToolRow {
  id: number;
  name: string;
  status: string;
}

/** Un día del reporte de trabajo: el detalle completo de la bitácora, no solo un resumen. */
export interface ReporteCierrePdfDiaBitacora {
  /** Ya formateada para el reporte (ej. "27-ago-2026"). */
  fecha: string;
  totalHoras: number;
  actividades: { startTime: string; endTime: string; durationHours: number; detail: string }[];
}

/** Un día del uso de herramientas, con todos sus registros (estado, picker, presión, peso…). */
export interface ReporteCierrePdfDiaUso {
  fecha: string;
  usos: { herramienta: string; estado: string; tipo: string; picker: string; presion: string; peso: string; observacion: string }[];
}

export interface ReporteCierrePdfDialogData {
  header: OperativoDocHeader;
  tipoOtLabel: string;
  estimatedDate: string;
  phases: ReporteCierrePdfPhaseRow[];
  tools: ReporteCierrePdfToolRow[];
  bitacora: ReporteCierrePdfDiaBitacora[];
  usoHerramientas: ReporteCierrePdfDiaUso[];
  /** Encabezado de la columna Tipo del uso: "Tipo de trabajo" (servicio) o "Tipo de completación" (venta). */
  tipoUsoLabel: string;
  totalHours: number;
  observationsCount: number;
  nombreArchivo: string;
}

/**
 * Vista imprimible del Resumen de Cierre de Ticket FCR — no es un formato
 * normado (a diferencia de DYN-SGI-RE-047 / DYN-FCR-RE-008), es un resumen
 * ejecutivo de todo lo realizado en el ticket para el cliente/archivo.
 * Mismo mecanismo que el resto de diálogos imprimibles: `window.print()` +
 * `@media print`, sin librería de PDF. Hoja horizontal: el uso de
 * herramientas tiene 7 columnas y en vertical no entra legible.
 */
@Component({
  selector: 'app-reporte-cierre-pdf-dialog',
  imports: [DatePipe, DecimalPipe, DuracionPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-cierre-pdf-dialog.html',
  styleUrl: './reporte-cierre-pdf-dialog.scss',
})
export class ReporteCierrePdfDialog {
  protected readonly data = inject<ReporteCierrePdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<ReporteCierrePdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  /** Solo las fases con finalización — la fase en curso no cuenta. */
  protected readonly fasesCompletadas = computed(() => this.data.phases.filter(f => !!f.fin).length);
  protected readonly registrosDeUso = computed(() => this.data.usoHerramientas.reduce((n, dia) => n + dia.usos.length, 0));

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  print(): void {
    imprimirDocumento({ orientacion: 'landscape', nombreArchivo: this.data.nombreArchivo });
  }

  close(): void {
    this.modalRef.close();
  }
}
