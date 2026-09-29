import { FCR_PHASE_LABELS, type FcrObservation, type FcrPhase, type FcrPhaseApproval, type FcrTicket } from './fcr.model';
import { fcrPhaseKeys } from './fcr-flow';

export type FcrHistoryState = 'done' | 'current' | 'pending';

/** Una etapa del historial del ticket: su tramo de tiempo, quién aprobó la salida y sus observaciones. */
export interface FcrHistoryStage {
  phase: FcrPhase;
  label: string;
  state: FcrHistoryState;
  inicio?: string;
  fin?: string;
  duracionMs?: number;
  actor?: string;
  /** Aprobación que hizo avanzar el ticket FUERA de esta etapa (`FcrPhaseApproval.phase` es la etapa destino). */
  aprobacion?: FcrPhaseApproval;
  observaciones: FcrObservation[];
}

/**
 * Arma la línea de tiempo por etapa con lo que ya trae el ticket: los tramos
 * de `timelineResumen` (calculados por el backend), `phaseHistory` y las
 * observaciones de Revisión inicial. No inventa datos: una etapa sin tramo
 * queda sin fechas.
 */
export function buildFcrHistory(t: FcrTicket): FcrHistoryStage[] {
  const keys = fcrPhaseKeys(t.tipoOt);
  const currentIndex = keys.indexOf(t.currentPhase);
  const closed = t.status === 'cerrado';
  const tramos = t.timelineResumen?.tramos ?? [];
  return keys.map((phase, i) => {
    const tramo = tramos.filter(x => x.fase === phase).at(-1);
    const next = keys[i + 1];
    const state: FcrHistoryState = i < currentIndex || (closed && i === currentIndex) ? 'done' : i === currentIndex ? 'current' : 'pending';
    return {
      phase,
      label: FCR_PHASE_LABELS[phase],
      state,
      inicio: tramo?.inicio,
      fin: tramo?.fin,
      duracionMs: tramo?.duracionMs,
      actor: tramo?.actorNombre ?? tramo?.actorRolLabel,
      aprobacion: next ? t.phaseHistory.filter(p => p.phase === next).at(-1) : undefined,
      observaciones: phase === 'revision_inicial' ? t.observations : [],
    };
  });
}
