import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OperativoActivityLogEntry, OperativoDocHeader } from '../../models/operativo-docs.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDiaDoc, fechaDoc } from '../documento-format.util';

/** Datos del encabezado del formato que no viajan en `OperativoDocHeader` — opcionales: si no se pasan, quedan en blanco. */
export interface ReporteJobExtras {
  campoBloque?: string;
  taladro?: string;
  ordenContrato?: string;
  representanteCliente?: string;
  cargoRepresentante?: string;
  observaciones?: string;
}

const FILAS_MINIMAS = 14;

/**
 * Formato DYN-SGI-RE-047 "Reporte diario de actividades de operaciones": datos del servicio, bitácora con inicio /
 * fin / horas y detalle (agrupada por día), tiempo total, observaciones y las dos firmas (Supervisor Dynadrill y
 * Representante del Cliente) — con nombre impreso y firma / C.I. en blanco; la firma se pone sobre el PDF.
 */
@Component({
  selector: 'app-doc-reporte-job',
  imports: [DecimalPipe, DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-job-hoja.html',
  styleUrl: './reporte-job-hoja.scss',
})
export class ReporteJobHoja {
  readonly header = input.required<OperativoDocHeader>();
  readonly log = input.required<OperativoActivityLogEntry[]>();
  readonly extras = input<ReporteJobExtras>({});

  protected readonly fecha = fechaDoc;

  private readonly ordenado = computed(() =>
    [...this.log()].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
  );

  /** Filas del cuerpo: una fila azul por día y debajo sus actividades; se completa con renglones vacíos. */
  protected readonly filas = computed(() => {
    const filas: ({ tipo: 'dia'; dia: string } | { tipo: 'act'; e: OperativoActivityLogEntry } | { tipo: 'vacia' })[] = [];
    let diaActual = '';
    for (const e of this.ordenado()) {
      if (e.date !== diaActual) {
        diaActual = e.date;
        filas.push({ tipo: 'dia', dia: fechaDiaDoc(e.date) });
      }
      filas.push({ tipo: 'act', e });
    }
    while (filas.length < FILAS_MINIMAS) filas.push({ tipo: 'vacia' });
    return filas;
  });

  protected readonly totalHoras = computed(() => this.log().reduce((acc, e) => acc + e.durationHours, 0));

  protected readonly fechaReporte = computed(() => {
    const o = this.ordenado();
    return o.length ? fechaDoc(o[o.length - 1].date) : '';
  });
}
