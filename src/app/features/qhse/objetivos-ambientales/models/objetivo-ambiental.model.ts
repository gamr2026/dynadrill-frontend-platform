/**
 * Objetivos del Sistema de Gestión Ambiental (ver OBJETIVOS AMBIENTALES.xlsx,
 * revisión anual) — cada objetivo tiene una meta, un indicador, un plazo y
 * un plan de acción asociado (acción específica, responsable, frecuencia,
 * periodo de evaluación). Distinto de la Matriz de Aspectos e Impactos
 * Ambientales: acá no hay probabilidad×consecuencia, es un objetivo/meta
 * anual estilo ISO-14001, no un registro de riesgo por actividad.
 */
export interface PlanAccionAmbiental {
  accionEspecifica?: string;
  responsable?: string;
  evidencia?: string;
  indicador?: string;
  frecuencia?: string;
  periodoEvaluacion?: string;
}

export interface ObjetivoAmbiental {
  id: number;
  code: string;
  titulo: string;
  plazo?: string;

  objetivoAmbiental: string;
  meta: string;
  indicador: string;
  beneficioEmpresarial?: string;
  resultado?: string;
  evidencia?: string;

  planAccion?: PlanAccionAmbiental;

  createdAt: string;
}

export type CreateObjetivoAmbientalInput = Omit<ObjetivoAmbiental, 'id' | 'code' | 'createdAt'>;

export type EstadoObjetivoAmbiental = 'vigente' | 'por_vencer' | 'vencido' | 'sin_plazo';

const AVISO_DIAS_ANTES = 30;

/** Mismo criterio que otros "vigente/por vencer/vencido" del módulo QHSE (ART, checklist de equipos): compara `plazo` contra hoy. */
export function estadoObjetivoAmbiental(plazo: string | undefined, hoy: Date = new Date()): EstadoObjetivoAmbiental {
  if (!plazo) return 'sin_plazo';
  const fechaPlazo = new Date(plazo);
  const diasRestantes = Math.ceil((fechaPlazo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= AVISO_DIAS_ANTES) return 'por_vencer';
  return 'vigente';
}

export const ESTADO_OBJETIVO_LABELS: Record<EstadoObjetivoAmbiental, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_plazo: 'Sin plazo',
};
