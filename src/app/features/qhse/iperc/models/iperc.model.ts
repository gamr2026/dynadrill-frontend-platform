/**
 * Fases de HSE-PLAN-001: Preparación → Identificación/Evaluación inicial →
 * Controles/Reevaluación → Documentación y aprobación. "borrador" cubre la
 * Fase 1 (desglose de actividad en tareas); los peligros se pueden
 * identificar desde ahí mismo, a la par de cada tarea — solo la
 * evaluación de riesgo (probabilidad x severidad) y los controles quedan
 * para cuando la matriz pasa a "en_evaluacion".
 */
export type IpercStatus = 'borrador' | 'en_evaluacion' | 'en_revision' | 'aprobada' | 'rechazada';

export const IPERC_STATUS_LABELS: Record<IpercStatus, string> = {
  borrador: 'Borrador',
  en_evaluacion: 'En evaluación',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

export type ControlType = 'ingenieria' | 'administrativo' | 'epp';

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  ingenieria: 'Ingeniería',
  administrativo: 'Administrativo',
  epp: 'EPP',
};

export interface IpercControl {
  id: number;
  type: ControlType;
  description: string;
}

/**
 * El formato DYN-SGI-RE-087 describe su ficha con notación GTC 45
 * (ND/NE/NP/NC/NR), pero el cuerpo de HSE-PLAN-001 define la evaluación
 * real con la matriz simple Probabilidad x Severidad (1-5 cada eje) — es
 * la que implementa dynadrill-risk-matrix en dynadrill-ui, y la que se
 * sigue acá. Si más adelante se exige el desglose GTC 45 completo (ND x NE
 * por separado, NC por separado), este es el modelo a extender sin romper
 * la matriz visual ni el resto del módulo.
 */
export interface IpercHazard {
  id: number;
  /** Peligro identificado. */
  peligro: string;
  /** Fuente/origen del riesgo. */
  fuenteRiesgo: string;
  /** Controles que ya existían antes de esta evaluación (texto libre, Fase 1-2). */
  controlesExistentes: string;
  /** Riesgo inicial — Fase 2, sin los controles nuevos definidos en Fase 3. */
  probabilidadInicial: number | null;
  severidadInicial: number | null;
  /** Controles nuevos definidos en Fase 3 (ingeniería/administrativos/EPP). */
  controles: IpercControl[];
  /** Riesgo residual — Fase 3, con los controles de arriba ya aplicados. */
  probabilidadResidual: number | null;
  severidadResidual: number | null;
}

export interface IpercTask {
  id: number;
  /** Tarea dentro del desglose de la actividad (Fase 1). */
  descripcion: string;
  hazards: IpercHazard[];
}

/** DYN-SGI-RE-087 — único formato de HSE-PLAN-001 generado nativamente por el sistema (ver tabla de formatos del proceso). */
export interface IpercMatrix {
  id: number;
  code: string;
  status: IpercStatus;
  actividad: string;
  ubicacion: string;
  /** Nombres del equipo evaluador multidisciplinario (Fase 1). Texto libre por ahora — no requiere que cada integrante tenga usuario en el sistema. */
  equipoEvaluador: string[];
  tasks: IpercTask[];
  /**
   * Fase 4: "Elaborar procedimiento [operativo] y ATS base" — el diagrama
   * de HSE-PLAN-001 pone este paso ANTES de "¿Aprobado?", así que ambos
   * documentos se adjuntan directamente acá, previo a enviar la matriz a
   * revisión — no dependen de ningún otro proceso (en particular, no del
   * PTW: ese ni siquiera puede existir todavía, porque solo se abre a
   * partir de una matriz ya aprobada). Ninguno de los dos tiene código
   * DYN-SGI-RE-xxx propio ni aparece en la tabla de formatos del proceso.
   */
  atsAdjunto?: string;
  atsAdjuntadoAt?: string;
  procedimientoAdjunto?: string;
  procedimientoAdjuntadoAt?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Fase 4 — aprobación. "De momento una línea": usuario + fecha, sin
   * captura de firma manuscrita (ver decisiones del plan de desarrollo).
   */
  approvedByName?: string;
  approvedAt?: string;
  /**
   * Al rechazar, la matriz queda en "rechazada" (en vez de saltar
   * directo a "en_evaluacion") para que quien la levantó vea con claridad
   * que hubo un rechazo y por qué, antes de retomarla — ver
   * IpercDetailPage.resumeEvaluation().
   */
  rejectedByName?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  /**
   * HSE-MASTER-001 — ciclo de mejora continua: al cerrar una Investigación
   * (HSE-TRIAGE-002) que involucra esta actividad, se marca la matriz para
   * revisión con la lección aprendida ya redactada, en vez de solo un
   * banner informativo. El responsable de HSE-PLAN-001 la revisa, actualiza
   * controles si aplica y limpia el flag.
   */
  leccionAprendidaPendiente?: boolean;
  leccionAprendidaTexto?: string;
  leccionAprendidaInvestigacionCode?: string;
}

/** Fase 1 de HSE-PLAN-001 — lo mínimo para arrancar una matriz nueva en estado "borrador"; tasks/hazards se agregan después, dentro del detalle. */
export type CreateIpercMatrixInput = Pick<IpercMatrix, 'actividad' | 'ubicacion' | 'equipoEvaluador'>;
