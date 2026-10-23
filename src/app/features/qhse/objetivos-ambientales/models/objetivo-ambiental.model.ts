/**
 * Objetivos del Sistema de Gestión Ambiental (ver OBJETIVOS AMBIENTALES.xlsx, revisión anual) del contenedor `qhse`
 * (`/api/v2/qhse/objetivos-ambientales`): cada objetivo tiene una meta, un indicador, un plazo y un plan de acción (una acción por fila), se le da
 * seguimiento con registros fechados y se cierra como cumplido o no cumplido. Distinto de la matriz de aspectos e impactos: aquí no hay
 * probabilidad × consecuencia. Los ids son UUID (texto).
 */

export const PERMISO_OBJETIVOS_VER = 'qhse.objetivos_ambientales.ver';
export const PERMISO_OBJETIVOS_GESTIONAR = 'qhse.objetivos_ambientales.gestionar';

export type EstadoObjetivoAmbiental = 'en_curso' | 'cumplido' | 'no_cumplido';
/** Estado del plazo (solo corre mientras el objetivo está en curso). */
export type EstadoPlazoObjetivo = 'sin_plazo' | 'vigente' | 'por_vencer' | 'vencido';
/** Lo que se muestra en la bandeja: el plazo mientras está en curso; el resultado cuando ya se cerró. */
export type EstadoVisibleObjetivo = EstadoPlazoObjetivo | 'cumplido' | 'no_cumplido';

export const ESTADO_OBJETIVO_LABELS: Record<EstadoVisibleObjetivo, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_plazo: 'Sin plazo',
  cumplido: 'Cumplido',
  no_cumplido: 'No cumplido',
};

export type TonoObjetivo = 'success' | 'warning' | 'error' | 'neutral';
export const ESTADO_OBJETIVO_TONO: Record<EstadoVisibleObjetivo, TonoObjetivo> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'error',
  sin_plazo: 'neutral',
  cumplido: 'success',
  no_cumplido: 'error',
};

export interface Frecuencia {
  id: string;
  codigo: string;
  nombre: string;
}
export interface CatalogosObjetivos {
  frecuencias: Frecuencia[];
}

export interface ObjetivoResumen {
  id: string;
  numero: number;
  codigo: string;
  titulo: string;
  meta: string;
  indicador: string;
  estado: EstadoObjetivoAmbiental;
  plazo: string | null;
  estadoPlazo: EstadoPlazoObjetivo | null;
  diasParaVencer: number | null;
  avanceActual: number | null;
  ultimoSeguimiento: string | null;
}

export interface BandejaObjetivos {
  items: ObjetivoResumen[];
  kpi: { total: number; enCurso: number; vencidos: number; porVencer: number };
}

export interface AccionPlan {
  orden: number;
  accionEspecifica: string;
  responsable: { id: string; nombre: string | null } | null;
  indicador: string | null;
  evidenciaEsperada: string | null;
  frecuencia: { id: string; nombre: string } | null;
}

export interface SeguimientoObjetivo {
  id: string;
  fecha: string;
  avancePorcentaje: number;
  observacion: string;
  registradoPor: string | null;
  registradoAt: string;
}

export interface ObjetivoDetalle extends ObjetivoResumen {
  objetivo: string;
  beneficioEmpresarial: string | null;
  resultado: string | null;
  evidencia: string | null;
  cerradoAt: string | null;
  cerradoPor: string | null;
  creadoPor: string | null;
  createdAt: string;
  planAccion: AccionPlan[];
  seguimientos: SeguimientoObjetivo[];
}

export interface AccionPlanBorrador {
  accionEspecifica: string;
  responsableId?: string;
  indicador?: string;
  evidenciaEsperada?: string;
  frecuenciaId?: string;
}

export interface CrearObjetivo {
  titulo: string;
  objetivo: string;
  meta: string;
  indicador: string;
  beneficioEmpresarial?: string;
  /** AAAA-MM-DD */
  plazo?: string;
  planAccion?: AccionPlanBorrador[];
}

export interface CerrarObjetivo {
  estado: 'cumplido' | 'no_cumplido';
  resultado: string;
  evidencia?: string;
}

/** Lo que muestra la bandeja y el detalle: el plazo mientras está en curso y el resultado cuando ya se cerró. */
export function estadoVisible(
  o: Pick<ObjetivoResumen, 'estado' | 'estadoPlazo'>,
): EstadoVisibleObjetivo {
  return o.estado === 'en_curso' ? (o.estadoPlazo ?? 'sin_plazo') : o.estado;
}

/** Un plan de acción en blanco para el formulario. */
export function accionEnBlanco(): AccionPlanBorrador {
  return { accionEspecifica: '' };
}

/** Quita las acciones sin descripción (el formulario deja una fila vacía por defecto). */
export function accionesConContenido(filas: AccionPlanBorrador[]): AccionPlanBorrador[] {
  return filas
    .filter((f) => f.accionEspecifica.trim().length > 0)
    .map((f) => ({
      accionEspecifica: f.accionEspecifica.trim(),
      ...(f.responsableId ? { responsableId: f.responsableId } : {}),
      ...(f.indicador?.trim() ? { indicador: f.indicador.trim() } : {}),
      ...(f.evidenciaEsperada?.trim() ? { evidenciaEsperada: f.evidenciaEsperada.trim() } : {}),
      ...(f.frecuenciaId ? { frecuenciaId: f.frecuenciaId } : {}),
    }));
}
