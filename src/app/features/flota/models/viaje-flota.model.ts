/**
 * Modelos del Gerenciamiento de Viaje (DYN-SGI-RE-049, Flota `/api/operaciones/flota/gerenciamientos-viaje`). El puntaje, el nivel de
 * riesgo y quién autoriza los decide el servidor; aquí solo se describen las respuestas y se previsualiza el puntaje.
 */

export type TipoViaje = 'salida' | 'retorno';
export type NivelRiesgo = 'bajo' | 'medio' | 'alto';
export type EstadoViaje = 'pendiente' | 'autorizado' | 'rechazado';

export const TIPO_VIAJE_LABEL: Record<TipoViaje, string> = { salida: 'Salida', retorno: 'Retorno' };
export const NIVEL_LABEL: Record<NivelRiesgo, string> = {
  bajo: 'BAJO',
  medio: 'MEDIO',
  alto: 'ALTO',
};
export const ESTADO_VIAJE_LABEL: Record<EstadoViaje, string> = {
  pendiente: 'Pendiente de autorización',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
};

export interface PreguntaRiesgo {
  id: string;
  codigo: string;
  orden: number;
  texto: string;
  opciones: Array<{ id: string; etiqueta: string; puntos: number; impideConducir: boolean }>;
}

export interface UmbralRiesgo {
  nivel: NivelRiesgo;
  desdePuntos: number;
  permisoAutoriza: string;
  descripcion: string;
}

export interface UnidadViaje {
  id: string;
  codigo: string;
  nombre: string;
  categoriaPeso: 'pesado' | 'liviano' | null;
  placa: string | null;
}

export interface BodegaViaje {
  id: string;
  nombre: string;
}

/** Lectura mínima del ticket que ofrece Pumping al Conductor (`GET /operaciones/pumping/tickets/mis-viajes`). */
export interface ViajeContextoPumping {
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  cliente: { id: string; nombre: string } | null;
  destino: {
    campo: { id: string; nombre: string } | null;
    pozo: { id: string; nombre: string } | null;
  };
  serviciosPrincipales: Array<{ codigo: string; nombre: string }>;
  supervisor: { id: string; nombre: string } | null;
}

export interface ViajeResumen {
  id: string;
  codigo: string;
  tipo: TipoViaje;
  ticketId: string | null;
  fecha: string;
  conductor: { id: string; nombre: string };
  unidad: { id: string; codigo: string };
  puntajeTotal: number;
  nivel: NivelRiesgo;
  estado: EstadoViaje;
  puedeDecidir: boolean;
  createdAt: string;
}

export type ExtremoDetalle =
  | { tipo: 'bodega'; id: string; nombre: string }
  | { tipo: 'pozo'; id: string; nombre: string; campo: string | null };

export interface ViajeDetalle {
  id: string;
  codigo: string;
  tipo: TipoViaje;
  ticketId: string | null;
  ticketNumero: number | null;
  fecha: string;
  motivo: string;
  conductor: { id: string; nombre: string };
  unidad: {
    id: string;
    codigo: string;
    nombre: string;
    categoriaPeso: 'pesado' | 'liviano' | null;
    placa: string | null;
  };
  origen: ExtremoDetalle;
  destino: ExtremoDetalle;
  puntajeTotal: number;
  nivel: NivelRiesgo;
  descripcionNivel: string | null;
  pasajeros: string | null;
  puedeCombinarViajes: boolean | null;
  horaSalida: string | null;
  horaLlegada: string | null;
  datosPernocta: string | null;
  aprobacionTelefonica: { de: string; hora: string | null } | null;
  respuestas: Array<{ orden: number; pregunta: string; opcion: string; puntos: number }>;
  paradas: Array<{
    lugar: string;
    horaLlegada: string | null;
    horaSalida: string | null;
    detallePernocta: string | null;
  }>;
  comunicaciones: Array<{
    frecuencia: string;
    personaContacto: string;
    datosContacto: string | null;
  }>;
  estado: EstadoViaje;
  decision: {
    por: { id: string; nombre: string } | null;
    at: string;
    motivo: string | null;
  } | null;
  registradoPor: { id: string; nombre: string };
  createdAt: string;
  puedeDecidir: boolean;
}

export interface SolicitarViajeEntrada {
  tipo: TipoViaje;
  ticketId?: string;
  unidadId: string;
  fecha: string;
  motivo: string;
  origen: { bodegaId?: string; pozoId?: string };
  destino: { bodegaId?: string; pozoId?: string };
  respuestas: Array<{ preguntaId: string; opcionId: string }>;
  pasajeros?: string | null;
  puedeCombinarViajes?: boolean | null;
  horaSalida?: string | null;
  horaLlegada?: string | null;
  datosPernocta?: string | null;
  aprobacionTelefonica?: { de: string; hora: string } | null;
  paradas?: Array<{
    lugar: string;
    horaLlegada?: string | null;
    horaSalida?: string | null;
    detallePernocta?: string | null;
  }>;
  comunicaciones?: Array<{
    frecuencia: string;
    personaContacto: string;
    datosContacto?: string | null;
  }>;
}

/** Vista previa del puntaje (la decisión final es del servidor): suma de las opciones elegidas y nivel por umbrales. */
export function previsualizarRiesgo(
  preguntas: PreguntaRiesgo[],
  elegidas: Record<string, string>,
  umbrales: UmbralRiesgo[],
): { puntos: number; nivel: NivelRiesgo | null; impide: string | null; sinContestar: number } {
  let puntos = 0;
  let impide: string | null = null;
  let sinContestar = 0;
  for (const p of preguntas) {
    const o = p.opciones.find((x) => x.id === elegidas[p.id]);
    if (!o) {
      sinContestar++;
      continue;
    }
    puntos += o.puntos;
    if (o.impideConducir) impide = o.etiqueta;
  }
  const nivel =
    [...umbrales].sort((a, b) => b.desdePuntos - a.desdePuntos).find((u) => u.desdePuntos <= puntos)
      ?.nivel ?? null;
  return { puntos, nivel, impide, sinContestar };
}
