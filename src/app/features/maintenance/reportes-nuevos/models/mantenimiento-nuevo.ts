/**
 * Modelos del módulo Mantenimiento del backend nuevo (contenedor `operaciones`, ids UUID). Conviven con los de la demo
 * (`../../models`, ids numéricos) hasta el corte. El servidor es la autoridad: estados, códigos y permisos vienen de la API.
 */

export const PERMISO_MANTENIMIENTO_VER = 'mantenimiento.ordenes.ver';
export const PERMISO_MANTENIMIENTO_OPERACIONES_VER = 'mantenimiento.operaciones.ver';
export const PERMISO_MANTENIMIENTO_GESTIONAR = 'mantenimiento.ordenes.gestionar';

export type EstadoReporte = 'por_clasificar' | 'descartado' | 'clasificado';
export type OrigenReporte = 'pumping' | 'fcr' | 'vehiculos' | 'qhse';
export type EstadoOrden = 'pendiente' | 'en_mantenimiento' | 'requiere_cambios' | 'aceptada' | 'cerrada';

export interface UnidadResumen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'servicio' | 'auxiliar' | 'transporte';
  categoriaPeso?: 'pesado' | 'liviano' | null;
}

/** Novedades de un reporte de Pumping, o el texto del caso de QHSE. */
export interface NovedadesReporte {
  mecanica?: string | null;
  instrumentacion?: string | null;
  operaciones?: string | null;
  origen?: string | null;
  destino?: string | null;
  fechaLlegada?: string | null;
  operacionInterrumpida?: boolean | null;
  detalleInterrupcion?: string | null;
  unidadLista?: boolean | null;
  qhse?: string | null;
}

export interface ReporteRecibido {
  id: string;
  codigo: string;
  origen: OrigenReporte;
  estado: EstadoReporte;
  recibidoAt: string;
  unidad: UnidadResumen;
  ticket: { id: string; numero: number | null } | null;
  novedades: NovedadesReporte;
  descarte: { at: string; por: { id: string; nombre: string } | null; motivo: string } | null;
  ordenId: string | null;
}

export interface TipoSuborden {
  codigo: string;
  nombre: string;
  sufijo: string;
  asignable: boolean;
}

export interface SubordenResumen {
  id: string;
  codigo: string;
  tipo: { codigo: string; nombre: string };
  estado: { codigo: string; nombre: string };
  asignada: { id: string; nombre: string } | null;
  notaDerivacion: string | null;
  notaCorreccion: string | null;
}

export interface OrdenMantenimiento {
  id: string;
  codigo: string;
  estado: EstadoOrden;
  reporte: { id: string; codigo: string; origen: OrigenReporte };
  unidad: UnidadResumen;
  ticket: { id: string; numero: number | null } | null;
  creadaAt: string;
  retorno: { at: string; estadoFinal: 'disponible' | 'con_restricciones'; observaciones: string | null } | null;
  subordenes: SubordenResumen[];
}

/** Lo que se decide por cada tipo al clasificar. */
export interface AsignacionEntrada {
  tipo: string;
  usuarioId?: string | null;
  derivar?: boolean;
  notaDerivacion?: string | null;
}

export interface FiltroReportes {
  estado?: EstadoReporte;
  q?: string;
}

export const ESTADO_REPORTE_LABEL: Record<EstadoReporte, string> = {
  por_clasificar: 'Por clasificar',
  descartado: 'Descartado',
  clasificado: 'Clasificado',
};
export const TONO_ESTADO_REPORTE: Record<EstadoReporte, 'warning' | 'neutral' | 'success'> = {
  por_clasificar: 'warning',
  descartado: 'neutral',
  clasificado: 'success',
};

export const ESTADO_ORDEN_LABEL: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente',
  en_mantenimiento: 'En mantenimiento',
  requiere_cambios: 'Requiere cambios',
  aceptada: 'Aceptada',
  cerrada: 'Cerrada',
};
export const TONO_ESTADO_ORDEN: Record<EstadoOrden, 'warning' | 'neutral' | 'success' | 'info' | 'critical'> = {
  pendiente: 'warning',
  en_mantenimiento: 'info',
  requiere_cambios: 'critical',
  aceptada: 'success',
  cerrada: 'neutral',
};

export const ORIGEN_REPORTE_LABEL: Record<OrigenReporte, string> = {
  pumping: 'Pumping',
  fcr: 'FCR',
  vehiculos: 'Inspección de vehículos',
  qhse: 'QHSE',
};

/** Resumen de una línea de lo que reporta el operador (lo primero que traiga novedad). */
export function resumenNovedades(n: NovedadesReporte): string {
  const partes = [
    n.mecanica ? `Mecánica: ${n.mecanica}` : '',
    n.instrumentacion ? `Instrumentación: ${n.instrumentacion}` : '',
    n.operaciones ? `Operaciones: ${n.operaciones}` : '',
    n.qhse ? `QHSE: ${n.qhse}` : '',
  ].filter(Boolean);
  return partes.join(' · ') || 'Sin novedades registradas';
}

/** Un tipo elegido en el diálogo de clasificación. */
export interface FilaClasificacion {
  tipo: string;
  elegido: boolean;
  usuarioId: string | null;
  derivar: boolean;
  notaDerivacion: string;
}

/** Arma lo que se envía al servidor: solo los tipos elegidos, con lo que aplica a cada uno. */
export function asignacionesDeFilas(filas: FilaClasificacion[], tipos: TipoSuborden[]): AsignacionEntrada[] {
  return filas
    .filter(f => f.elegido)
    .map(f => {
      const asignable = tipos.find(t => t.codigo === f.tipo)?.asignable ?? true;
      return asignable
        ? { tipo: f.tipo, usuarioId: f.usuarioId }
        : { tipo: f.tipo, derivar: f.derivar, notaDerivacion: f.derivar && f.notaDerivacion.trim() ? f.notaDerivacion.trim() : null };
    });
}

/** Qué falta para poder clasificar (`null` = listo). */
export function validarClasificacion(filas: FilaClasificacion[]): string | null {
  return filas.some(f => f.elegido) ? null : 'Elija al menos un tipo de mantenimiento.';
}

export function mensajeErrorMantenimiento(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  const texto = Array.isArray(m) ? m.filter(x => typeof x === 'string').join('. ') : typeof m === 'string' ? m : '';
  if (e?.status === 403) return texto || 'No tiene permiso para esta acción.';
  if (e?.status === 409) return texto || 'El reporte cambió. Recargue e intente de nuevo.';
  return texto || porDefecto;
}
