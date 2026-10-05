/**
 * Documentos QHSE reales de un pedido (Formato de Recepción, ART, PT, SFI)
 * — ver PLAN-QHSE-PUMPING-NOTIFICACIONES, Fase 2. Mismo shape que
 * `EstadoDocumentalPedido` del backend (`QhseDocumentosService`).
 */
export interface EstadoDocumentalPedido {
  formatoRecepcion: boolean;
  sfi: boolean;
  carnetVacunas: boolean;
  /** `null` = nunca se subió un ART para este pedido. */
  artVigente: boolean | null;
  artFechaEmision: string | null;
  artVigenciaHasta: string | null;
  artVenceEnDias: number | null;
  ptHoy: boolean;
  /** `null` = el pedido todavía no tiene ticket de Pumping. Ver Fase 2, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS. */
  checklistIngreso: ChecklistIngresoEstado | null;
  /** Fase 3: aprobación del Company Man, confirmada por el Supervisor en el ticket de Pumping. `null` = todavía no se confirmó. */
  companyManAprobado: CompanyManAprobado | null;
}

export interface CompanyManAprobado {
  aprobadoPor: string;
  aprobadoAt: string;
}

/** Solo lectura para QHSE — lo llena Operativo desde su ticket de Pumping. */
export interface ChecklistIngresoEstado {
  toolboxTalkRealizado: boolean;
  walkaroundCompletado: boolean;
  lineaBaseAmbientalDocumentada: boolean;
  rutasEmergenciaVerificadas: boolean;
  simopsConfirmado: boolean;
  gasReadings: { gas: string; lectura: number; seguro: boolean; medidoAt: string }[];
  lotoChecklist: { label: string; checked: boolean }[];
  completo: boolean;
  confirmadoPor: string | null;
  confirmadoAt: string | null;
}

export interface PedidoConEstadoDocumental {
  pedidoId: number;
  /** 'pumping' | 'fcr'. */
  lineaServicio: string;
  code: string;
  cliente: string;
  campo: string;
  pozo: string;
  fechaInicioServicio: string | null;
  createdAt: string;
  estado: EstadoDocumentalPedido;
}

export const QHSE_TIPO_FORMATO_RECEPCION = 'qhse_formato_recepcion';
export const QHSE_TIPO_SFI = 'qhse_sfi';
export const QHSE_TIPO_CARNET_VACUNAS = 'qhse_carnet_vacunas';
export const QHSE_REFERENCIA_VIGENTE = 'vigente';
