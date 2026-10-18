/**
 * Modelos de la inspección de vehículos (DYN-SGI-RE-068) y de los documentos de los conductores (Flota, `/api/operaciones/flota`).
 * La autoridad de las reglas (documentos vigentes, Nota 1, estados) es el backend; aquí solo se describen las respuestas.
 */

export type MomentoInspeccion = 'salida' | 'llegada';
export type ResultadoChecklist = 'cumple' | 'no_cumple' | 'no_aplica';
export type SeccionInspeccion = 'vehiculo' | 'equipo';
export type EstadoCaso = 'pendiente' | 'por_aprobar' | 'aprobada';
export type EstadoInspeccion = EstadoCaso | 'anulada';
export type EstadoDocumento = 'vigente' | 'por_vencer' | 'vencido' | 'faltante';

export const ESTADO_INSPECCION_LABEL: Record<EstadoInspeccion, string> = {
  pendiente: 'Pendiente',
  por_aprobar: 'Por aprobar',
  aprobada: 'Aprobada',
  anulada: 'Anulada',
};

export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumento, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  faltante: 'Sin registrar',
};

export interface ItemInspeccion {
  id: string;
  codigo: string;
  seccion: SeccionInspeccion;
  orden: number;
  etiqueta: string;
  /** Nota 1 del formato: con este ítem en «No cumple» el vehículo no puede usarse. */
  bloqueaSiNoCumple: boolean;
}

export interface CasoInspeccion {
  id: string;
  ticketId: string;
  unidad: {
    id: string;
    codigo: string;
    nombre: string;
    vehiculo: { id: string; placa: string } | null;
  };
  operador: { id: string; nombre: string };
  estado: EstadoCaso;
  salidaInspeccionId: string | null;
  llegadaInspeccionId: string | null;
}

export interface InspeccionResumen {
  id: string;
  momento: MomentoInspeccion;
  fecha: string;
  unidad: { id: string; codigo: string; nombre: string };
  conductor: { id: string; nombre: string };
  ticketId: string | null;
  km: number | null;
  hayNovedades: boolean;
  estado: EstadoInspeccion;
}

export interface InspeccionDetalle {
  id: string;
  momento: MomentoInspeccion;
  fecha: string;
  puntoPartida: string;
  destino: string | null;
  observaciones: string | null;
  km: number | null;
  unidad: {
    id: string;
    codigo: string;
    nombre: string;
    vehiculo: {
      placa: string;
      marca: string | null;
      modelo: string | null;
      anio: number | null;
    } | null;
    documentos: {
      fechaMatricula: string | null;
      caducidadMatricula: string | null;
      caducidadPoliza: string | null;
      vigenciaOtroDocumento: string | null;
    };
  };
  caso: { id: string; ticketId: string; operador: { id: string; nombre: string } } | null;
  conductor: { id: string; nombre: string };
  registradaPor: { id: string; nombre: string };
  registradaAt: string;
  anulada: { at: string; por: { id: string; nombre: string } | null; motivo: string | null } | null;
  estado: EstadoInspeccion;
  hayNovedades: boolean;
  bloqueaUso: boolean;
  resultados: Array<{
    itemId: string;
    codigo: string;
    seccion: SeccionInspeccion;
    orden: number;
    etiqueta: string;
    resultado: ResultadoChecklist;
  }>;
  revisiones: Array<{
    decision: 'aprobada' | 'rechazada';
    motivo: string | null;
    por: { id: string; nombre: string };
    at: string;
  }>;
}

export interface RegistrarInspeccionEntrada {
  casoId?: string;
  unidadId?: string;
  momento?: MomentoInspeccion;
  fecha?: string;
  puntoPartida: string;
  destino?: string | null;
  conductorId: string;
  km: number;
  observaciones?: string | null;
  resultados: Array<{ itemId: string; resultado: ResultadoChecklist }>;
}

export interface DocumentoConductor {
  tipo: { id: string; codigo: string; nombre: string; conVigencia: boolean };
  estado: EstadoDocumento;
  vigenteHasta: string | null;
  diasRestantes: number | null;
  permisoId: string | null;
}

export interface TipoPermiso {
  id: string;
  codigo: string;
  nombre: string;
  conVigencia: boolean;
  orden: number;
}

export interface PermisoHistoria {
  id: string;
  tipo: { id: string; codigo: string; nombre: string };
  vigenteHasta: string | null;
  observaciones: string | null;
  registradoPor: { id: string; nombre: string };
  registradoAt: string;
  anulado: { at: string; motivo: string } | null;
}

export interface ConductorEstado {
  usuario: { id: string; nombre: string };
  reuneCondiciones: boolean;
  porVencer: string[];
  documentos: DocumentoConductor[];
}
