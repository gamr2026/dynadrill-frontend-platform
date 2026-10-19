/**
 * Tarjeta de observación STOP (DYN-SGI-RE-008, HSE-SEGUIMIENTO-002) del contenedor `qhse` (`/api/v2/qhse/stop`). Cualquier trabajador la
 * registra (el observador es quien tiene la sesión; la persona observada es opcional) marcando ítems del formato como seguros o inseguros;
 * QHSE la deriva a Mantenimiento o a otro departamento, o la resuelve, y cierra las derivadas. Los ids son UUID (texto).
 */

export const PERMISO_STOP_VER = 'qhse.stop.ver';
export const PERMISO_STOP_GESTIONAR = 'qhse.stop.gestionar';
/** Registrar una tarjeta es de cualquier trabajador (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';
/** Módulo del servicio de archivos por el que se sube la foto. */
export const MODULO_ARCHIVO_STOP_FOTO = 'qhse_stop_foto';

export type BloqueStop = 'acciones' | 'condiciones';
export type EstadoItemStop = 'seguro' | 'inseguro';
export type EstadoStop =
  'abierto' | 'derivado_mantenimiento' | 'derivado_otro' | 'resuelto_qhse' | 'cerrado';

export const ESTADO_STOP_ETIQUETA: Record<EstadoStop, string> = {
  abierto: 'Abierta',
  derivado_mantenimiento: 'Derivada a Mantenimiento',
  derivado_otro: 'Derivada a otro departamento',
  resuelto_qhse: 'Resuelta por QHSE',
  cerrado: 'Cerrada',
};
export const ESTADOS_STOP: EstadoStop[] = [
  'abierto',
  'derivado_mantenimiento',
  'derivado_otro',
  'resuelto_qhse',
  'cerrado',
];

export type TonoStop = 'success' | 'warning' | 'error' | 'neutral' | 'brand';
export const ESTADO_STOP_TONO: Record<EstadoStop, TonoStop> = {
  abierto: 'warning',
  derivado_mantenimiento: 'brand',
  derivado_otro: 'brand',
  resuelto_qhse: 'success',
  cerrado: 'neutral',
};

export interface ItemFormato {
  id: string;
  nombre: string;
}
export interface SubcategoriaFormato {
  id: string;
  codigo: string;
  nombre: string;
  items: ItemFormato[];
}
export interface FormatoStop {
  acciones: SubcategoriaFormato[];
  condiciones: SubcategoriaFormato[];
}

export interface StopResumen {
  id: string;
  numero: number;
  codigo: string;
  fecha: string;
  estado: EstadoStop;
  observador: string;
  observado: string | null;
  campo: string | null;
  operadora: string | null;
  lugar: string | null;
  inseguros: number;
  segurosCount: number;
  inseguroEnAcciones: boolean;
  inseguroEnCondiciones: boolean;
}

export interface StopDetalle {
  id: string;
  codigo: string;
  fecha: string;
  estado: EstadoStop;
  observador: { id: string; nombre: string };
  observado: { id: string; nombre: string } | null;
  campo: { id: string; nombre: string } | null;
  operadora: { id: string; nombre: string } | null;
  lugar: string | null;
  contacto: string | null;
  fotoArchivoId: string | null;
  accionesQueObserva: string | null;
  accionesAccion: string | null;
  condicionesQueObserva: string | null;
  condicionesAccion: string | null;
  items: {
    itemId: string;
    item: string;
    subcategoria: string;
    bloque: BloqueStop;
    estado: EstadoItemStop;
  }[];
  atendidoPor: string | null;
  atendidoAt: string | null;
  atendidoObservacion: string | null;
  cerradoPor: string | null;
  cerradoAt: string | null;
  historial: {
    estadoAnterior: EstadoStop | null;
    estadoNuevo: EstadoStop;
    observacion: string | null;
    actor: string;
    at: string;
  }[];
}

export interface Tendencias {
  desde: string;
  hasta: string;
  totalTarjetas: number;
  porSubcategoria: {
    subcategoria: string;
    bloque: BloqueStop;
    inseguros: number;
    seguros: number;
  }[];
  itemsMasRepetidos: { item: string; subcategoria: string; inseguros: number }[];
  porMes: { mes: string; tarjetas: number }[];
}

export interface RegistrarStop {
  observadoId?: string;
  campoId?: string;
  operadoraId?: string;
  lugar?: string;
  contacto?: string;
  fotoArchivoId?: string;
  accionesQueObserva?: string;
  accionesAccion?: string;
  condicionesQueObserva?: string;
  condicionesAccion?: string;
  items: { itemId: string; estado: EstadoItemStop }[];
}

/** Marcas que el observador va poniendo: id del ítem → seguro o inseguro (un ítem sin marca no se guarda). */
export type Marcas = ReadonlyMap<string, EstadoItemStop>;

/** Pone o quita una marca: tocar de nuevo el mismo estado la quita. Devuelve un mapa nuevo. */
export function marcar(marcas: Marcas, itemId: string, estado: EstadoItemStop): Marcas {
  const nuevo = new Map(marcas);
  if (nuevo.get(itemId) === estado) nuevo.delete(itemId);
  else nuevo.set(itemId, estado);
  return nuevo;
}

export function itemsDeMarcas(marcas: Marcas): { itemId: string; estado: EstadoItemStop }[] {
  return [...marcas.entries()].map(([itemId, estado]) => ({ itemId, estado }));
}

export function conteoMarcas(marcas: Marcas): { seguros: number; inseguros: number } {
  let inseguros = 0;
  for (const e of marcas.values()) if (e === 'inseguro') inseguros++;
  return { seguros: marcas.size - inseguros, inseguros };
}

/** Lo que falta para registrar (el servidor lo exige igual): al menos un ítem marcado. */
export function pendientesDeRegistro(marcas: Marcas): string[] {
  return marcas.size ? [] : ['marcar al menos un ítem como seguro o inseguro'];
}

export type AccionStop = 'derivar_mantenimiento' | 'derivar_otro' | 'resolver' | 'cerrar';

/** Qué puede hacer QHSE hoy con la tarjeta: una abierta se deriva o se resuelve; una derivada se cierra; el resto, nada. */
export function accionesDisponibles(estado: EstadoStop): AccionStop[] {
  if (estado === 'abierto') return ['derivar_mantenimiento', 'derivar_otro', 'resolver'];
  if (estado === 'derivado_mantenimiento' || estado === 'derivado_otro') return ['cerrar'];
  return [];
}

/** Ancho de barra (0–100) de cada fila del Pareto, relativo a la mayor. */
export function porcentajesDePareto(filas: { inseguros: number }[]): number[] {
  const max = Math.max(0, ...filas.map((f) => f.inseguros));
  return filas.map((f) => (max ? Math.round((f.inseguros / max) * 100) : 0));
}
