import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DocumentoEncabezado } from '../documento-encabezado';

export interface IndicadoresMantenimientoDatos {
  /** Texto del filtro aplicado: "Todos los tipos de unidad · 01/09/2026 al 30/09/2026". */
  filtros: string;
  generadoEn: string;
  kpis: { label: string; value: string }[];
  cumplimiento: { cumplen: number; noCumplen: number };
  disponibilidad: { disponibles: number; noDisponibles: number };
  ordenesPorTipo: { tipo: string; cantidad: number }[];
  fallasRepetitivas: { unidad: string; cantidad: number }[];
  ordenes: { code: string; unidad: string; fecha: string; estado: string }[];
}

/** Reporte de los Indicadores de Mantenimiento (MAN-MASTER-001) con el filtro vigente al momento de descargarlo. */
@Component({
  selector: 'app-doc-indicadores-mantenimiento',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './indicadores-mantenimiento-hoja.html',
  styleUrl: './indicadores-mantenimiento-hoja.scss',
})
export class IndicadoresMantenimientoHoja {
  readonly datos = input.required<IndicadoresMantenimientoDatos>();

  protected porcentaje(parte: number, otra: number): string {
    const total = parte + otra;
    return total ? `${Math.round((parte / total) * 100)} %` : '—';
  }
}
