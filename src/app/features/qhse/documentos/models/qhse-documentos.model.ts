/**
 * Documentos QHSE reales de un pedido (Formato de Recepción, ART, PT, SFI)
 * — ver PLAN-QHSE-PUMPING-NOTIFICACIONES, Fase 2. Mismo shape que
 * `EstadoDocumentalPedido` del backend (`QhseDocumentosService`).
 */
export interface EstadoDocumentalPedido {
  formatoRecepcion: boolean;
  sfi: boolean;
  /** `null` = nunca se subió un ART para este pedido. */
  artVigente: boolean | null;
  artFechaEmision: string | null;
  artVigenciaHasta: string | null;
  artVenceEnDias: number | null;
  ptHoy: boolean;
}

export interface PedidoConEstadoDocumental {
  pedidoId: number;
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
export const QHSE_REFERENCIA_VIGENTE = 'vigente';
