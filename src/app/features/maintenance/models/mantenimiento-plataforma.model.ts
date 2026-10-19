/**
 * Respuestas y entradas del backend nuevo de Mantenimiento (`/api/operaciones/mantenimiento/*`, contenedor operaciones).
 * Las pantallas siguen usando los modelos de la demo (`UnitReport`, `MaintenanceOrderWithSubOrders`, `SubOrder`): el traductor
 * está en `mantenimiento-plataforma.mapper.ts`. Contrato completo: documentacion/modulos/plan-mantenimiento.md y
 * 02-CONTRATOS-ENTRE-MODULOS.md (4.1-bis).
 */

export type OrigenReporteApi = 'pumping' | 'fcr' | 'vehiculos' | 'qhse';
export type EstadoReporteApi = 'por_clasificar' | 'descartado' | 'clasificado';
export type TipoSubordenApi = 'mecanico' | 'instrumental' | 'operativo';
export type EstadoSubordenApi =
  | 'pendiente'
  | 'en_diagnostico'
  | 'en_ejecucion'
  | 'en_revision_cierre'
  | 'correccion_solicitada'
  | 'cerrado'
  | 'derivado_a_pumping';
export type EstadoOrdenApi =
  'pendiente' | 'en_mantenimiento' | 'requiere_cambios' | 'aceptada' | 'cerrada';

export interface PersonaApi {
  id: string;
  nombre: string;
}

export interface UnidadReporteApi {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'servicio' | 'auxiliar' | 'transporte';
  categoriaPeso: 'pesado' | 'liviano' | null;
}

/** Novedades de un reporte que viene de Pumping (se leen de su reporte de unidad) o, de QHSE, un solo texto. */
export interface NovedadesApi {
  mecanica?: string | null;
  instrumentacion?: string | null;
  operaciones?: string | null;
  origen?: string | null;
  destino?: string | null;
  fechaLlegada?: string | null;
  operacionInterrumpida?: boolean;
  detalleInterrupcion?: string | null;
  unidadLista?: boolean;
  qhse?: string | null;
}

export interface ReporteApi {
  id: string;
  codigo: string;
  origen: OrigenReporteApi;
  estado: EstadoReporteApi;
  recibidoAt: string;
  unidad: UnidadReporteApi;
  ticket: { id: string; numero: number } | null;
  novedades: NovedadesApi;
  descarte: { at: string; por: PersonaApi | null; motivo: string | null } | null;
  ordenId: string | null;
}

export interface RepuestoApi {
  id: string;
  cantidad: number;
  articulo: { id: string; codigo: string; nombre: string } | null;
  bodega: { id: string; nombre: string } | null;
  numeroParte: string | null;
  descripcion: string | null;
  /** Salida del kardex que respalda el renglón (solo después de aprobar el cierre). */
  movimientoId: string | null;
}

export interface SubordenApi {
  id: string;
  codigo: string;
  ordenId: string;
  tipo: { codigo: TipoSubordenApi; nombre: string };
  estado: { codigo: EstadoSubordenApi; nombre: string };
  asignada: PersonaApi | null;
  asignadaPor: PersonaApi | null;
  notaDerivacion: string | null;
  notaCorreccion: string | null;
  diagnostico: string | null;
  actividadesCorrectivas: string | null;
  horasTrabajo: number | null;
  trabajosAdicionales: string | null;
  ejecucionIniciadaAt: string | null;
  ejecucionTerminadaAt: string | null;
  cierreAprobadoAt: string | null;
  repuestos: RepuestoApi[];
}

export interface OrdenApi {
  id: string;
  codigo: string;
  estado: EstadoOrdenApi;
  reporte: { id: string; codigo: string; origen: OrigenReporteApi };
  unidad: { id: string; codigo: string; nombre: string; tipo: string };
  ticket: { id: string; numero: number } | null;
  creadaAt: string;
  retorno: {
    at: string;
    por: string | null;
    estadoFinal: 'disponible' | 'con_restricciones' | null;
    observaciones: string | null;
  } | null;
  subordenes: SubordenApi[];
}

export interface AsignacionApi {
  tipo: TipoSubordenApi;
  /** Mecánico o instrumental: la cuenta del operador de mantenimiento. */
  usuarioId?: string | null;
  /** Operativo: `true` lo deriva a Pumping; `false` lo deja pendiente. */
  derivar?: boolean;
  notaDerivacion?: string | null;
}

/** Un repuesto al guardar el avance: del catálogo (artículo + bodega) o de texto (número de parte). */
export interface RepuestoEntradaApi {
  articuloId?: string;
  bodegaId?: string;
  numeroParte?: string;
  descripcion?: string | null;
  cantidad: number;
}

export interface AvanceEntradaApi {
  diagnostico?: string | null;
  actividadesCorrectivas?: string | null;
  horasTrabajo?: number | null;
  trabajosAdicionales?: string | null;
  repuestos?: RepuestoEntradaApi[];
}
