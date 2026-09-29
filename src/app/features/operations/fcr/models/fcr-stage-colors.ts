import type { FcrPhase } from './fcr.model';

export interface FcrStageColor {
  /** Encabezado de columna y franja lateral de la tarjeta. */
  accent: string;
  /** Texto sobre `accent` — cumple contraste AA (≥ 4.5:1) en cada caso. */
  onAccent: string;
}

const ON_DARK = '#ffffff';
const ON_LIGHT = '#1c1b1f';

/**
 * Un color por etapa del proceso FCR (variables `color/stage/*` del mockup
 * de Figma). Solo como acento — nunca como color de texto sobre fondo claro.
 */
export const FCR_STAGE_COLORS: Record<FcrPhase, FcrStageColor> = {
  revision_inicial: { accent: '#4f5bd5', onAccent: ON_DARK },
  preparacion_herramientas: { accent: '#00796b', onAccent: ON_DARK },
  tipo_operador: { accent: '#7e57c2', onAccent: ON_DARK },
  inspeccion: { accent: '#d81b60', onAccent: ON_DARK },
  aprobacion_supervisor_operaciones: { accent: '#8e24aa', onAccent: ON_DARK },
  asignacion: { accent: '#1565c0', onAccent: ON_DARK },
  reunion_operativa: { accent: '#bf360c', onAccent: ON_DARK },
  ejecucion_operativa: { accent: '#f9a825', onAccent: ON_LIGHT },
  revision_reportes: { accent: '#6d4c41', onAccent: ON_DARK },
  control_retorno: { accent: '#2e7d32', onAccent: ON_DARK },
  cierre: { accent: '#546e7a', onAccent: ON_DARK },
};
