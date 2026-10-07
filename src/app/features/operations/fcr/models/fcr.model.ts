import { Ticket } from '../../../../shared/models/ticket.model';
import type { MacroEstado } from '../../../../shared/models/timeline.model';
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
  // ── Entrada SERVICIOS (nueva) — arranca en preparacion_herramientas ──
  | 'tipo_operador'
  | 'inspeccion'
  | 'aprobacion_supervisor_operaciones'
  // ── Entrada VENTA + tronco común (ya existían) ──
  | 'revision_inicial'
  | 'preparacion_herramientas'
  | 'asignacion'
  | 'reunion_operativa'
  | 'ejecucion_operativa'
  | 'revision_reportes'
  | 'control_retorno'
  | 'cierre';

export const FCR_PHASE_LABELS: Record<FcrPhase, string> = {
  tipo_operador: 'Tipo de Operador',
  inspeccion: 'Formulario de Inspección',
  aprobacion_supervisor_operaciones: 'Aprobación de Supervisor de Operaciones',
  revision_inicial: 'Revisión Inicial',
  preparacion_herramientas: 'Preparación de Herramientas',
  asignacion: 'Asignación de Operador',
  reunion_operativa: 'Reunión Operativa',
  ejecucion_operativa: 'Ejecución Operativa',
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
  inspeccion: { roleName: 'Operador FCR', roleId: 18 },
  aprobacion_supervisor_operaciones: { roleName: 'Supervisor Operaciones FCR', roleId: 15 },
  revision_inicial: { roleName: 'Supervisor', roleId: 1 },
  preparacion_herramientas: { roleName: 'Supervisor', roleId: 1 },
  asignacion: { roleName: 'Supervisor', roleId: 1 },
  reunion_operativa: { roleName: 'Supervisor', roleId: 1 },
  ejecucion_operativa: { roleName: 'Operador FCR', roleId: 18 },
  revision_reportes: { roleName: 'Supervisor', roleId: 1 },
  // Antes 'Control de Herramientas' (rol eliminado) — Bodega ya cubre el flujo.
  control_retorno: { roleName: 'Bodeguero', roleId: 11 },
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

/** Check de un actor sobre una herramienta, en Preparación de Herramientas — `novedad` bloquea el avance al siguiente paso hasta corregirlo. */
export interface FcrToolCheck {
  marcado: boolean;
  usuario?: string;
  fecha?: string;
  novedad?: string;
}

export interface FcrTool {
  id: number;
  /**
   * Referencia al catálogo real de Inventario (`Articulo`, `categoria='HERRAMIENTAS'`).
   * Opcional porque los tickets FCR sembrados antes de este cambio no lo tienen
   * (no se hizo backfill) — el checklist de inspección queda deshabilitado para esas herramientas.
   */
  articuloId?: number;
  name: string;
  status: FcrToolStatus;
  missingReason?: string;
  /** 'pedido' = auto-cargada de itemsEstimados del Pedido (esHerramienta); 'manual' = agregada como excepción (herramienta dañada a sustituir, algo que el Pedido no contempló). */
  origen?: 'pedido' | 'manual';
  /** Snapshot de `Articulo.stockActual` al momento de auto-cargar — informativo, no hay reserva real de stock en el sistema. */
  stockDisponible?: number;
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
  /**
   * Solicitud del Supervisor → Bodega → Recepción del Supervisor. El
   * Mecánico/Soldador NO tiene check acá: todavía no está asignado (eso
   * pasa después, en 'tipo_operador') — su estado en la UI es un reflejo
   * automático del checklist real de inspección (`FcrToolInspection`, fase
   * 'inspeccion'), no un check manual de esta pantalla.
   */
  bodega?: FcrToolCheck;
  recepcion?: FcrToolCheck;
}

/** Estado general de una herramienta en Preparación de Herramientas — derivado de los 2 checks manuales (Bodega/Recepción), nunca se persiste. */
export type FcrToolEstado =
  | 'pendiente_solicitud'
  | 'pendiente_bodega'
  | 'novedad_bodega'
  | 'pendiente_envio_bodega'
  | 'pendiente_recepcion'
  | 'novedad_recepcion'
  | 'check';

export const FCR_TOOL_ESTADO_LABELS: Record<FcrToolEstado, string> = {
  pendiente_solicitud: 'Pendiente de solicitud del Supervisor',
  pendiente_bodega: 'Pendiente de Bodega',
  novedad_bodega: 'Con novedad — Bodega',
  pendiente_envio_bodega: 'Pendiente de envío a Supervisor',
  pendiente_recepcion: 'Pendiente de recepción',
  novedad_recepcion: 'Con novedad — Recepción',
  check: 'Check',
};

/**
 * Un color distinto por etapa del proceso (no solo éxito/advertencia) —
 * mismo vocabulario que `DynadrillTagVariant` de la librería UI, sin
 * importarlo acá para no acoplar el modelo a la UI (estructuralmente
 * compatible igual).
 */
export const FCR_TOOL_ESTADO_VARIANT: Record<FcrToolEstado, 'brand' | 'neutral' | 'success' | 'warning' | 'error' | 'info'> = {
  pendiente_solicitud: 'neutral',
  pendiente_bodega: 'info',
  novedad_bodega: 'error',
  pendiente_envio_bodega: 'info',
  pendiente_recepcion: 'brand',
  novedad_recepcion: 'error',
  check: 'success',
};

/**
 * Deriva el Estado general de la herramienta a partir de sus 3 checks — se
 * calcula siempre en el cliente, nunca se guarda (mismo criterio que
 * `toolStatusLabel` antes de este cambio). Una novedad en cualquier paso
 * bloquea el avance al siguiente hasta que se corrija.
 */
export function estadoDeHerramienta(tool: FcrTool): FcrToolEstado {
  // `status === 'recibida'` es la señal terminal (la pone `setRecepcionCheck` sin novedad) —
  // se chequea primero para que tickets sembrados antes de este cambio (sin los objetos
  // `bodega`/`recepcion`) igual muestren "Check" en vez de "Pendiente de Bodega".
  if (tool.status === 'recibida') return 'check';
  if (!tool.sentToBodega) return 'pendiente_solicitud';
  if (!tool.bodega?.marcado) return 'pendiente_bodega';
  if (tool.bodega.novedad) return 'novedad_bodega';
  if (!tool.sentToSupervisor) return 'pendiente_envio_bodega';
  if (!tool.recepcion?.marcado) return 'pendiente_recepcion';
  if (tool.recepcion.novedad) return 'novedad_recepcion';
  // Llegar hasta acá (bodega y recepción OK, sin novedad) implica `status === 'recibida'`
  // salvo un dato viejo de una build anterior donde Recepción no cambiaba `status` —
  // TS ya probó arriba que en este punto `status` no puede ser 'recibida', así que se
  // muestra "Pendiente de recepción" en vez de mentir "Check" en ese caso.
  return 'pendiente_recepcion';
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
  /** Agregado por el backend junto con `timelineResumen` — opcional porque el historial de tickets viejos no siempre lo trae. */
  macroEstado?: MacroEstado;
}

// ── Documentos operativos (Reporte Job DYN-SGI-RE-047 / Reporte de Herramientas DYN-FCR-RE-008) ──
// Los tipos viven en `shared/` porque también los produce Pumping y los consume Facturación.

export type FcrActivityLogEntry = OperativoActivityLogEntry;

/** Registro del envío de un día de bitácora a Facturación — lo arma el backend con hora del servidor. */
export interface FcrDiaBitacoraEnviado {
  fecha: string;
  enviadoAt: string;
  enviadoPor: string;
  modificadoAt?: string;
  modificadoPor?: string;
  modificadoRol?: 'Operador' | 'Facturación';
}
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
  /** Decide qué entrada usa este ticket (preparacion_herramientas vs. revision_inicial) — viene del Pedido, no editable aquí. */
  tipoOt: TipoOt;
  proposalVersion: number;
  /** Código del Pedido de Facturación asociado — link para el puente FCR → Facturación. */
  pedidoCode?: string;
  /** FK real del Pedido asociado (columna escalar del ticket) — se usa para traer el detalle completo de solo lectura en 'revision_inicial'. */
  pedidoId?: number | null;
  tools: FcrTool[];
  // ── Entrada SERVICIOS ──
  tipoOperador?: TipoOperador;
  /** Operador mecánico/soldador elegido en 'tipo_operador' (roster simulado) — quien repara e inspecciona por herramienta. Autocompleta "Reparado por" en cada checklist. */
  assignedMechanicOperator?: string;
  formularioInspeccionExternoUploaded?: boolean;
  formularioInspeccionExternoNombreArchivo?: string;
  formatoDimensionamientoServicioUploaded?: boolean;
  formatoDimensionamientoServicioNombreArchivo?: string;
  formatoDurezaServicioUploaded?: boolean;
  formatoDurezaServicioNombreArchivo?: string;
  inspeccionAprobada?: boolean;
  // ── Documentos de VENTA que faltaban ──
  registroDurezaUploaded?: boolean;
  registroDurezaNombreArchivo?: string;
  registroQaqcUploaded?: boolean;
  registroQaqcNombreArchivo?: string;
  /** "Todo el listado está completo" (venta) / "El listado está completo de uso" (servicio). */
  pickerUsageListConfirmed?: boolean;
  /** RN-FCR-005 / SP7: declaración explícita del Supervisor de que no quedan herramientas por agregar. */
  toolListConfirmed: boolean;
  inspectionDocumentUploaded: boolean;
  inspectionDocumentNombreArchivo?: string;
  movementGuideGenerated: boolean;
  reviewGuideGenerated: boolean;
  operationalMeetingDate: string;
  operationalActaSigned: boolean;
  workReportUploaded: boolean;
  toolReportUploaded: boolean;
  finalReviewGuideUploaded: boolean;
  activityLog: FcrActivityLogEntry[];
  /** Días de la bitácora ya enviados a Facturación (envío diario). Ausente en tickets anteriores a esa funcionalidad. */
  diasBitacoraEnviados?: FcrDiaBitacoraEnviado[];
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
