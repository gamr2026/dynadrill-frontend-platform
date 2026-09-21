/**
 * Macro-estado universal calculado por el backend (ver `MacroEstado` en
 * dynadrill-backend, `libs/common/src/estados/macro-estado.ts`) — la misma
 * categoría de 6 valores aplica a Pedido, FcrTicket y PumpingTicket, sin
 * importar cuántas fases específicas tenga cada uno. Pensado para que la
 * app hable un solo vocabulario de estado en vez de uno distinto por módulo.
 */
export type MacroEstado = 'borrador' | 'pendiente' | 'en_proceso' | 'esperando_aprobacion' | 'aprobado' | 'rechazado';

export const MACRO_ESTADO_LABELS: Record<MacroEstado, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  esperando_aprobacion: 'Esperando aprobación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

/** Mismo vocabulario de tonos que ya acepta `DynadrillTagComponent` — un solo mapeo para los 3 módulos. */
export type MacroEstadoTone = 'brand' | 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const MACRO_ESTADO_TONE: Record<MacroEstado, MacroEstadoTone> = {
  borrador: 'neutral',
  pendiente: 'warning',
  en_proceso: 'brand',
  esperando_aprobacion: 'info',
  aprobado: 'success',
  rechazado: 'error',
};

/** Un tramo del timeline — la entidad estuvo en `fase` desde `inicio` hasta `fin` (o hasta ahora, si es el tramo activo). */
export interface TimelineTramo {
  fase: string;
  macroEstado: MacroEstado;
  inicio: string;
  fin?: string;
  duracionMs: number;
  /** Nombre real de persona cuando el backend pudo resolverlo (cuenta canónica del rol, o email conocido) — si no, lo que haya quedado persistido. */
  actorNombre?: string;
  /** Email del actor — separado de `actorNombre` para no tener que adivinar si ese campo es un nombre o un email. */
  actorEmail?: string;
  actorRol?: string;
  /** Nombre legible del rol ("Supervisor Pumping") — ver `actorRol` para el código de autorización. */
  actorRolLabel?: string;
  motivo?: string;
}

/** Calculado por el backend al leer la entidad — no se persiste, no se edita desde el frontend. */
export interface TimelineResumen {
  faseActual: string;
  macroEstadoActual: MacroEstado;
  responsableRolActual: string | null;
  iniciadoEn: string;
  faseActualDesde: string;
  tiempoEnFaseActualMs: number;
  tiempoTotalMs: number;
  tramos: TimelineTramo[];
}
