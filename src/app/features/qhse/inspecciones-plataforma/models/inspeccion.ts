/**
 * Inspecciones de campo (HSE-SEGUIMIENTO-001) del contenedor `qhse` (`/api/v2/qhse/inspecciones`): eslinga de cable, detector de gas y
 * vehículo-grúa. Se evalúan TODOS los criterios del tipo; si alguno falla la inspección queda rechazada y el equipo en cuarentena hasta una
 * inspección nueva aprobada. Un vehículo-grúa rechazado origina un reporte de unidad para Mantenimiento. La vigencia es trimestral.
 */

export const PERMISO_INSPECCIONES_VER = 'qhse.inspecciones.ver';
/** Registrar una inspección es de cualquier usuario autenticado (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';

export type ResultadoInspeccion = 'aprobado' | 'rechazado';
export const RESULTADO_ETIQUETA: Record<ResultadoInspeccion, string> = {
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
};

export interface CriterioTipo {
  id: string;
  nombre: string;
}

export interface TipoInspeccion {
  id: string;
  codigo: string;
  nombre: string;
  frecuenciaDias: number;
  requiereBumpTest: boolean;
  requiereUnidad: boolean;
  generaCasoMantenimiento: boolean;
  criterios: CriterioTipo[];
}

export interface InspeccionResumen {
  id: string;
  codigo: string;
  tipo: { id: string; codigo: string; nombre: string };
  equipoCodigo: string;
  unidadId: string | null;
  unidadCodigo: string | null;
  inspector: string;
  fecha: string;
  resultado: ResultadoInspeccion;
  vigenteHasta: string;
  vencida: boolean;
}

export interface InspeccionDetalle extends Omit<InspeccionResumen, 'vencida'> {
  bumpTestRealizado: boolean | null;
  observaciones: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  criterios: { criterio: string; cumple: boolean }[];
}

export interface EstadoEquipo {
  tipo: { codigo: string; nombre: string };
  equipoCodigo: string;
  unidadCodigo: string | null;
  ultimaInspeccion: { id: string; codigo: string; fecha: string; resultado: ResultadoInspeccion };
  enCuarentena: boolean;
  proximaDebida: string;
  atrasada: boolean;
  vigenteHasta: string;
  vigenciaVencida: boolean;
  diasParaProxima: number;
}

export interface RegistrarInspeccion {
  tipoId: string;
  equipoCodigo: string;
  unidadId?: string;
  unidadCodigo?: string;
  bumpTestRealizado?: boolean;
  observaciones?: string;
  resultados: { criterioId: string; cumple: boolean }[];
}

/** Respuestas que el inspector va marcando: id del criterio → cumple (`true`) o falla (`false`); sin marca = aún no evaluado. */
export type Evaluacion = ReadonlyMap<string, boolean>;

export function evaluar(e: Evaluacion, criterioId: string, cumple: boolean): Evaluacion {
  const nuevo = new Map(e);
  nuevo.set(criterioId, cumple);
  return nuevo;
}

/** Resultado que tendrá la inspección con lo marcado: rechazada si algún criterio falla; `null` mientras falte evaluar alguno. */
export function resultadoDe(
  tipo: Pick<TipoInspeccion, 'criterios'>,
  e: Evaluacion,
): ResultadoInspeccion | null {
  if (tipo.criterios.some((c) => !e.has(c.id))) return null;
  return tipo.criterios.some((c) => e.get(c.id) === false) ? 'rechazado' : 'aprobado';
}

/** Criterios que fallan (para avisar antes de registrar que el equipo quedará en cuarentena). */
export function criteriosQueFallan(
  tipo: Pick<TipoInspeccion, 'criterios'>,
  e: Evaluacion,
): string[] {
  return tipo.criterios.filter((c) => e.get(c.id) === false).map((c) => c.nombre);
}

/** Lo que falta para registrar (el servidor y la base lo exigen igual); vacío = se puede. */
export function pendientesDeInspeccion(
  tipo: TipoInspeccion | null,
  datos: { equipoCodigo: string; unidadId: string; bumpTest: boolean | null },
  e: Evaluacion,
): string[] {
  if (!tipo) return ['elegir el tipo de equipo'];
  const falta: string[] = [];
  if (tipo.requiereUnidad ? !datos.unidadId : !datos.equipoCodigo.trim())
    falta.push(tipo.requiereUnidad ? 'elegir la unidad' : 'indicar el número o código del equipo');
  if (tipo.requiereBumpTest && datos.bumpTest === null)
    falta.push('indicar si se hizo el bump test');
  const sin = tipo.criterios.filter((c) => !e.has(c.id)).length;
  if (sin) falta.push(`evaluar ${sin} criterio(s)`);
  return falta;
}

/** Texto de la próxima inspección debida: «hoy», «en N días» o «atrasada N días». */
export function textoProxima(diasParaProxima: number): string {
  if (diasParaProxima === 0) return 'Hoy';
  if (diasParaProxima > 0) return `En ${diasParaProxima} ${diasParaProxima === 1 ? 'día' : 'días'}`;
  const atraso = -diasParaProxima;
  return `Atrasada ${atraso} ${atraso === 1 ? 'día' : 'días'}`;
}
