import { Ticket } from '../../../../shared/models/ticket.model';
import {
  TOOL_DAILY_STATUS_CODE,
  TOOL_DAILY_STATUS_LABELS,
  type OperativoActivityLogEntry,
  type OperativoToolUsageEntry,
  type ToolDailyStatus,
} from '../../../../shared/models/operativo-docs.model';
import type { TipoCompletacion, TipoOperador, TipoPicker, TipoTrabajo } from './fcr-catalogos.model';

/** Decide qué entrada de FcrPhase usa este ticket — lo elige Ventas al crear el Pedido, no editable desde FCR. */
export type TipoOt = 'venta' | 'servicio';

// ── Fases del ticket FCR (FCR-MASTER-001) ──

export type FcrPhase =
  // ── Entrada SERVICIOS (nueva) — confluye en preparacion_herramientas ──
  | 'tipo_operador'
  | 'reparacion'
  | 'inspeccion'
  | 'aprobacion_supervisor_operaciones'
  // ── Entrada VENTA + tronco común (ya existían) ──
  | 'validacion'
  | 'preparacion_herramientas'
  | 'asignacion_operador'
  | 'reunion_operativa'
  | 'ejecucion_campo'
  | 'revision_reportes'
  | 'control_retorno'
  | 'cierre';

export const FCR_PHASE_LABELS: Record<FcrPhase, string> = {
  tipo_operador: 'Tipo de Operador',
  reparacion: 'Reparación',
  inspeccion: 'Formulario de Inspección',
  aprobacion_supervisor_operaciones: 'Aprobación de Supervisor de Operaciones',
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
 * (mismo patrón que PUMPING_STEP_ROLE en pumping.model.ts). En sync manual
 * con FCR_PHASE_ROLE en dynadrill-backend (workflow-role.maps.ts).
 */
export const FCR_PHASE_ROLE: Record<FcrPhase, { roleName: string; roleId: number }> = {
  tipo_operador: { roleName: 'Supervisor', roleId: 1 },
  reparacion: { roleName: 'Operador', roleId: 2 },
  inspeccion: { roleName: 'Operador', roleId: 2 },
  aprobacion_supervisor_operaciones: { roleName: 'Supervisor Operaciones FCR', roleId: 15 },
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

// ── Documentos operativos (Reporte Job DYN-SGI-RE-047 / Reporte de Herramientas DYN-FCR-RE-008) ──
// Los tipos viven en `shared/` porque también los produce Pumping y los consume Facturación.

export type FcrActivityLogEntry = OperativoActivityLogEntry;
export type FcrToolDailyStatus = ToolDailyStatus;
export const FCR_TOOL_DAILY_STATUS_LABELS = TOOL_DAILY_STATUS_LABELS;
export const FCR_TOOL_DAILY_STATUS_CODE = TOOL_DAILY_STATUS_CODE;

/**
 * Extiende el tipo compartido (`OperativoToolUsageEntry`, también usado por Pumping/Facturación) con los
 * campos propios de FCR del tronco compartido — completación/trabajo + picker + presión/peso/observación,
 * "por herramienta" y no general al ticket (confirmado con el usuario). No se tocó el tipo compartido para
 * no filtrar conceptos de FCR (tipoOt no existe en Pumping) al resto de consumidores.
 */
export interface FcrToolUsageEntry extends OperativoToolUsageEntry {
  tipoCompletacion?: TipoCompletacion;
  tipoTrabajo?: TipoTrabajo;
  tipoPicker?: TipoPicker;
  presion?: string;
  peso?: string;
  /** Solo se llena si hubo alguna novedad durante el uso de la herramienta. */
  observacion?: string;
}

// ── Ticket FCR ──

export interface FcrTicket extends Ticket {
  currentPhase: FcrPhase;
  /** Decide qué entrada usa este ticket (tipo_operador vs. validacion) — viene del Pedido, no editable aquí. */
  tipoOt: TipoOt;
  proposalVersion: number;
  /** Código del Pedido de Facturación asociado — link para el puente FCR → Facturación. */
  pedidoCode?: string;
  tools: FcrTool[];
  // ── Entrada SERVICIOS ──
  tipoOperador?: TipoOperador;
  reparacionDescripcion?: string;
  formularioInspeccionExternoUploaded?: boolean;
  formatoDimensionamientoServicioUploaded?: boolean;
  formatoDurezaServicioUploaded?: boolean;
  inspeccionAprobada?: boolean;
  // ── Documentos de VENTA que faltaban ──
  registroDurezaUploaded?: boolean;
  registroQaqcUploaded?: boolean;
  /** "Todo el listado está completo" (venta) / "El listado está completo de uso" (servicio). */
  pickerUsageListConfirmed?: boolean;
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
