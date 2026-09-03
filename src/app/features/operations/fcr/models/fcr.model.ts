import { Ticket } from '../../../../shared/models/ticket.model';

// ── Fases del ticket FCR (FCR-MASTER-001) ──

export type FcrPhase =
  | 'validacion'
  | 'preparacion_herramientas'
  | 'asignacion_operador'
  | 'reunion_operativa'
  | 'ejecucion_campo'
  | 'revision_reportes'
  | 'control_retorno'
  | 'cierre';

export const FCR_PHASE_LABELS: Record<FcrPhase, string> = {
  validacion: 'Validación',
  preparacion_herramientas: 'Preparación de Herramientas',
  asignacion_operador: 'Asignación de Operador',
  reunion_operativa: 'Reunión Operativa',
  ejecucion_campo: 'Ejecución de Campo',
  revision_reportes: 'Revisión de Reportes',
  control_retorno: 'Control de Retorno',
  cierre: 'Cierre',
};

/**
 * Rol responsable de actuar en cada fase — usado tanto para el banner
 * "Esperando acción de" como para el auto-switch de rol en la demo
 * (mismo patrón que PUMPING_STEP_ROLE en pumping.model.ts).
 */
export const FCR_PHASE_ROLE: Record<FcrPhase, { roleName: string; roleId: number }> = {
  validacion: { roleName: 'Supervisor', roleId: 1 },
  preparacion_herramientas: { roleName: 'Supervisor', roleId: 1 },
  asignacion_operador: { roleName: 'Supervisor', roleId: 1 },
  reunion_operativa: { roleName: 'Supervisor', roleId: 1 },
  ejecucion_campo: { roleName: 'Operador', roleId: 2 },
  revision_reportes: { roleName: 'Supervisor', roleId: 1 },
  control_retorno: { roleName: 'Control de Herramientas', roleId: 14 },
  cierre: { roleName: 'Supervisor', roleId: 1 },
};

// ── Herramientas (FCR-002 / FCR-007) ──

export type FcrToolStatus = 'seleccionada' | 'en_preparacion' | 'recibida' | 'devuelta' | 'faltante';

export const FCR_TOOL_STATUS_LABELS: Record<FcrToolStatus, string> = {
  seleccionada: 'Seleccionada',
  en_preparacion: 'En preparación (Bodega)',
  recibida: 'Recibida',
  devuelta: 'Devuelta',
  faltante: 'Faltante',
};

export interface FcrTool {
  id: number;
  name: string;
  status: FcrToolStatus;
  missingReason?: string;
  /** Se agregó después de que el resto de la selección ya había avanzado — se muestra aparte para no confundirla con la tanda original. */
  addedLate?: boolean;
  /**
   * Envío formal a Bodega, por herramienta (no por ticket): mientras sea
   * `false`, es removible; una vez `true`, queda fija — no existe "reabrir"
   * para volver a quitarla. Se resetea a `false` solo si se corrige de
   * vuelta a "seleccionada".
   */
  sentToBodega?: boolean;
  /** Simétrico a `sentToBodega`, para el envío de Bodega de vuelta al Supervisor. */
  sentToSupervisor?: boolean;
}

// ── Historial de observaciones (FCR-001 / FCR-006) ──

export interface FcrObservation {
  id: number;
  author: string;
  role: string;
  date: string;
  message: string;
}

// ── Historial de aprobación de fases ──

/** Registro de quién confirmó el avance hacia `phase` — una vez confirmado, el paso queda bloqueado. */
export interface FcrPhaseApproval {
  phase: FcrPhase;
  approvedBy: string;
  approvedByRole: string;
  date: string;
}

// ── Bitácora de actividades de campo (Reporte Job — DYN-SGI-RE-047) ──

/** Una entrada de la bitácora horaria de Ejecución de Campo — la duración se calcula, nunca se captura a mano. */
export interface FcrActivityLogEntry {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  detail: string;
  author: string;
}

// ── Uso diario de herramientas (Reporte de Herramientas en Renta — DYN-FCR-RE-008) ──

export type FcrToolDailyStatus = 'operacion' | 'stand_by' | 'daily_charge' | 'venta';

export const FCR_TOOL_DAILY_STATUS_LABELS: Record<FcrToolDailyStatus, string> = {
  operacion: 'En operación',
  stand_by: 'Stand-by',
  daily_charge: 'Daily charge',
  venta: 'Consumible / venta',
};

/** Código de una sola letra usado en el DYN-FCR-RE-008 real (O/S/D/V). */
export const FCR_TOOL_DAILY_STATUS_CODE: Record<FcrToolDailyStatus, string> = {
  operacion: 'O',
  stand_by: 'S',
  daily_charge: 'D',
  venta: 'V',
};

/** Un día de uso registrado para una herramienta — un registro por (herramienta, fecha); registrar de nuevo esa combinación reemplaza el estado del día. */
export interface FcrToolUsageEntry {
  id: number;
  toolId: number;
  date: string;
  status: FcrToolDailyStatus;
}

// ── Ticket FCR ──

export interface FcrTicket extends Ticket {
  currentPhase: FcrPhase;
  proposalVersion: number;
  tools: FcrTool[];
  /** RN-FCR-005 / SP7: declaración explícita del Supervisor de que no quedan herramientas por agregar. */
  toolListConfirmed: boolean;
  inspectionDocumentUploaded: boolean;
  movementGuideGenerated: boolean;
  reviewGuideGenerated: boolean;
  operationalMeetingDate: string;
  operationalActaSigned: boolean;
  workReportUploaded: boolean;
  toolReportUploaded: boolean;
  finalReviewGuideUploaded: boolean;
  activityLog: FcrActivityLogEntry[];
  toolUsageLog: FcrToolUsageEntry[];
  observations: FcrObservation[];
  reportsApproved: boolean;
  bodegaExitGuideGenerated: boolean;
  toolReturnComplete: boolean;
  surveySent: boolean;
  phaseHistory: FcrPhaseApproval[];
}

// ── Motivos de herramienta faltante (FCR-007) ──

export type MissingToolReason = 'venta_complementaria' | 'perdida' | 'dano' | 'otro';

export const MISSING_TOOL_REASON_LABELS: Record<MissingToolReason, string> = {
  venta_complementaria: 'Venta de herramienta complementaria al cliente',
  perdida: 'Pérdida en campo',
  dano: 'Daño irreparable',
  otro: 'Otro motivo',
};
