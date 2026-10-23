/**
 * Encuestas de la plataforma (`/api/encuestas`): las plantillas con sus preguntas las administra el Superadmin, y el cliente contesta
 * desde el enlace de su correo (`/api/encuestas/publico/:token`, sin sesión).
 */

export const PERMISO_ENCUESTAS = 'encuestas.administracion.gestionar';

export type TipoRespuesta = 'escala' | 'texto' | 'si_no' | 'opcion_unica' | 'opcion_multiple';

export const TIPO_RESPUESTA_LABEL: Record<TipoRespuesta, string> = {
  escala: 'Escala de calificación',
  texto: 'Texto libre',
  si_no: 'Sí o no',
  opcion_unica: 'Una opción',
  opcion_multiple: 'Varias opciones',
};

export const TIPOS_RESPUESTA = Object.keys(TIPO_RESPUESTA_LABEL) as TipoRespuesta[];

export type EstadoVersion = 'borrador' | 'publicada' | 'archivada';

export const ESTADO_VERSION_LABEL: Record<EstadoVersion, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  archivada: 'Archivada',
};

export type EstadoInvitacion = 'pendiente' | 'respondida' | 'vencida';

export const ESTADO_INVITACION_LABEL: Record<EstadoInvitacion, string> = {
  pendiente: 'Pendiente',
  respondida: 'Respondida',
  vencida: 'Vencida',
};

export interface ModuloEncuesta {
  codigo: string;
  nombre: string;
}

export interface ValorEscala {
  valor: number;
  etiqueta: string;
}

export interface EscalaEncuesta {
  id: string;
  codigo: string;
  nombre: string;
  valores: ValorEscala[];
}

export interface EncuestaResumen {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  moduloCodigo: string;
  moduloNombre: string;
  vigente: { id: string; numero: number; titulo: string; publicadaAt: string | null } | null;
  borrador: { id: string; numero: number } | null;
}

export interface VersionDeEncuesta {
  id: string;
  numero: number;
  estado: EstadoVersion;
  titulo: string;
  publicadaAt: string | null;
  preguntas: number;
  invitaciones: number;
}

export interface EncuestaDetalle {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  moduloCodigo: string;
  moduloNombre: string;
  versiones: VersionDeEncuesta[];
}

export interface PreguntaVersion {
  id: string;
  orden: number;
  texto: string;
  tipo: TipoRespuesta;
  obligatoria: boolean;
  escala: EscalaEncuesta | null;
  opciones: Array<{ id: string; orden: number; etiqueta: string }>;
}

export interface VersionDetalle {
  id: string;
  numero: number;
  estado: EstadoVersion;
  titulo: string;
  introduccion: string | null;
  publicadaAt: string | null;
  encuesta: { id: string; codigo: string; nombre: string; moduloCodigo: string };
  preguntas: PreguntaVersion[];
}

/** Una pregunta tal como se edita en el borrador (todavía sin id: el servidor reemplaza la lista completa). */
export interface PreguntaEditable {
  texto: string;
  tipo: TipoRespuesta;
  obligatoria: boolean;
  escalaId: string | null;
  opciones: string[];
}

export interface PreguntaEntrada {
  texto: string;
  tipo: TipoRespuesta;
  obligatoria: boolean;
  escalaId?: string;
  opciones?: string[];
}

export interface InvitacionResumen {
  id: string;
  encuesta: { id: string; codigo: string; nombre: string };
  version: number;
  moduloCodigo: string;
  referenciaId: string;
  correoDestino: string;
  creadaAt: string;
  venceAt: string;
  enviadaAt: string | null;
  envioError: string | null;
  estado: EstadoInvitacion;
  respondidaAt: string | null;
  respondiente: { nombre: string; cargo: string | null } | null;
}

export interface InvitacionesPagina {
  total: number;
  items: InvitacionResumen[];
}

export interface FiltroInvitaciones {
  encuestaId?: string;
  estado?: EstadoInvitacion;
  limite?: number;
  desplazamiento?: number;
}

export interface RespuestaDeInvitacion {
  preguntaId: string;
  texto: string;
  tipo: TipoRespuesta;
  valor: unknown;
}

export interface InvitacionDetalle extends Omit<InvitacionResumen, 'version'> {
  version: number;
  titulo: string;
  respuestas: RespuestaDeInvitacion[];
}

// ── Formulario público ──

export interface PreguntaPublica {
  id: string;
  orden: number;
  texto: string;
  tipo: TipoRespuesta;
  obligatoria: boolean;
  escala: ValorEscala[] | null;
  opciones: Array<{ id: string; etiqueta: string }>;
}

export interface EncuestaPublica {
  titulo: string;
  introduccion: string | null;
  venceAt: string;
  preguntas: PreguntaPublica[];
}

/** Lo que el cliente contestó, por id de pregunta: número (escala), texto, booleano, id de opción o lista de ids. */
export type RespuestasEnCurso = Record<string, number | string | boolean | string[] | null>;

export interface ResponderEntrada {
  nombre: string;
  cargo?: string;
  respuestas: Array<{ preguntaId: string; valor: unknown }>;
}

// ── Reglas de pantalla ──

const MAX_OPCIONES = 20;

/** ¿Esta respuesta cuenta como contestada? (una lista vacía o un texto en blanco no cuentan) */
export function estaContestada(valor: RespuestasEnCurso[string] | undefined): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim() !== '';
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

/** Qué falta para poder enviar la encuesta (texto para el cliente); `null` si está completa. */
export function faltaPorResponder(
  nombre: string,
  preguntas: readonly PreguntaPublica[],
  respuestas: RespuestasEnCurso,
): string | null {
  if (!nombre.trim()) return 'Escriba su nombre.';
  const pendiente = preguntas.find((p) => p.obligatoria && !estaContestada(respuestas[p.id]));
  return pendiente ? `Falta responder: «${pendiente.texto}».` : null;
}

/** Arma el cuerpo del envío: solo las preguntas que el cliente contestó. */
export function armarEnvio(
  nombre: string,
  cargo: string,
  preguntas: readonly PreguntaPublica[],
  respuestas: RespuestasEnCurso,
): ResponderEntrada {
  return {
    nombre: nombre.trim(),
    ...(cargo.trim() ? { cargo: cargo.trim() } : {}),
    respuestas: preguntas
      .filter((p) => estaContestada(respuestas[p.id]))
      .map((p) => {
        const v = respuestas[p.id];
        return { preguntaId: p.id, valor: typeof v === 'string' ? v.trim() : v };
      }),
  };
}

export const PREGUNTA_NUEVA: PreguntaEditable = {
  texto: '',
  tipo: 'escala',
  obligatoria: true,
  escalaId: null,
  opciones: [],
};

/** Convierte las preguntas guardadas de una versión en filas editables. */
export function aEditables(preguntas: readonly PreguntaVersion[]): PreguntaEditable[] {
  return preguntas.map((p) => ({
    texto: p.texto,
    tipo: p.tipo,
    obligatoria: p.obligatoria,
    escalaId: p.escala?.id ?? null,
    opciones: p.opciones.map((o) => o.etiqueta),
  }));
}

export const llevaOpciones = (t: TipoRespuesta): boolean =>
  t === 'opcion_unica' || t === 'opcion_multiple';

/** Qué falta para guardar el borrador (texto para quien administra); `null` si está bien. */
export function validarPreguntas(preguntas: readonly PreguntaEditable[]): string | null {
  for (const [i, p] of preguntas.entries()) {
    const n = `La pregunta ${i + 1}`;
    if (!p.texto.trim()) return `${n} no tiene texto.`;
    if (p.tipo === 'escala' && !p.escalaId) return `${n} necesita una escala de calificación.`;
    if (llevaOpciones(p.tipo)) {
      const etiquetas = p.opciones.map((o) => o.trim());
      if (etiquetas.length < 2) return `${n} necesita al menos dos opciones.`;
      if (etiquetas.some((o) => !o)) return `${n} tiene una opción en blanco.`;
      if (etiquetas.length > MAX_OPCIONES) return `${n} admite hasta ${MAX_OPCIONES} opciones.`;
      if (new Set(etiquetas.map((o) => o.toLowerCase())).size !== etiquetas.length) {
        return `${n} tiene opciones repetidas.`;
      }
    }
  }
  return null;
}

/** Cuerpo de `PUT versiones/:id/preguntas`: cada pregunta lleva solo lo que su tipo usa. */
export function aEntrada(preguntas: readonly PreguntaEditable[]): PreguntaEntrada[] {
  return preguntas.map((p) => ({
    texto: p.texto.trim(),
    tipo: p.tipo,
    obligatoria: p.obligatoria,
    ...(p.tipo === 'escala' && p.escalaId ? { escalaId: p.escalaId } : {}),
    ...(llevaOpciones(p.tipo) ? { opciones: p.opciones.map((o) => o.trim()) } : {}),
  }));
}

/** El mensaje del servidor si lo hay (los de este módulo ya vienen en español); si no, el texto por defecto. */
export function mensajeErrorEncuesta(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join(' ') || porDefecto;
  if (typeof m === 'string' && m.trim() && (e?.status ?? 0) < 500) return m;
  if (e?.status === 403) return 'No tiene permiso para esta acción.';
  return porDefecto;
}

/** El valor de una respuesta ya guardada, en texto para la administración. */
export function textoDeRespuesta(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Sin respuesta';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.map((v) => textoDeRespuesta(v)).join(', ');
  if (typeof valor === 'object') {
    const o = valor as { etiqueta?: unknown; valor?: unknown };
    if (typeof o.etiqueta === 'string') {
      return typeof o.valor === 'number' ? `${o.valor} — ${o.etiqueta}` : o.etiqueta;
    }
    return 'Sin respuesta';
  }
  return String(valor);
}
