/**
 * HSE-SEGUIMIENTO-002 — Tarjetas STOP. "Cualquier Trabajador... tiene
 * autoridad y obligación de observar" — por eso la creación de la tarjeta
 * no pasa por el roleGuard de QHSE (ver header.ts, acceso "Reportar");
 * solo la bandeja/dashboard de tendencias queda reservada al staff HSE.
 */
export type StopTipo = 'acto_inseguro' | 'condicion_insegura';

export const STOP_TIPO_LABELS: Record<StopTipo, string> = {
  acto_inseguro: 'Acto inseguro',
  condicion_insegura: 'Condición insegura',
};

/** Las 8 categorías estándar del formato STOP. */
export const STOP_CATEGORIAS = [
  'EPP',
  'Herramientas y equipos',
  'Posición de las personas',
  'Procedimientos y reglas',
  'Orden y limpieza',
  'Protecciones y guardas',
  'Ergonomía',
  'Otro',
] as const;

export type StopCategoria = (typeof STOP_CATEGORIAS)[number];

export interface StopCard {
  id: number;
  code: string;
  tipo: StopTipo;
  categorias: StopCategoria[];
  descripcion: string;
  riesgoPotencial: string;
  accionCorrectivaInmediata: string;
  /** Obligatorio — quien reporta siempre queda identificado, aunque el observado sea anónimo. */
  observadorNombre: string;
  /** Opcional — "Anónimo" si el observado prefiere no identificarse. */
  observadoNombre?: string;
  fotoFileName?: string;
  ubicacion?: string;
  createdAt: string;
}

export type CreateStopCardInput = Omit<StopCard, 'id' | 'code' | 'createdAt'>;
