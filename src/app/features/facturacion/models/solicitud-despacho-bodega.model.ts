/**
 * Solicitud de Despacho a Bodega — correlación con "Orden Salida Material" /
 * "Aprobar Orden Salida Material" de AS2 (ver investigación en el chat: AS2
 * sí valida ahí el despacho de materiales/herramientas antes de continuar
 * con la OT). Facturación la crea con la prefactura ya generada; Bodega la
 * resuelve desde su bandeja (despachar adjuntando el respaldo, o rechazar
 * con motivo). El pedido queda `por_despachar_bodega` mientras está
 * pendiente y vuelve a `prefactura_generada` al resolverse.
 */

export type TipoItemDespacho = 'material' | 'herramienta';

export interface SolicitudDespachoItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  tipo: TipoItemDespacho;
}

export type EstadoSolicitudDespacho = 'pendiente' | 'despachado' | 'rechazado';

export interface SolicitudDespachoBodega {
  id: number;
  pedidoId: number;
  /** Solo en la bandeja de Bodega (`GET /solicitudes-despacho`) — Bodega no tiene acceso a `GET /pedidos`, así que el backend los embebe acá para no depender de una segunda llamada. */
  pedidoCode?: string;
  pedidoCliente?: string;
  numero: string;
  bodegaOrigen: string;
  fechaRequerida: string;
  items: SolicitudDespachoItem[];
  nota?: string;
  solicitadoPor: string;
  solicitadoAt: string;

  estado: EstadoSolicitudDespacho;

  despachadoPor?: string;
  despachadoAt?: string;
  notaBodega?: string;
  referenciaAs2?: string;

  motivoRechazo?: string;
  rechazadoPor?: string;
  rechazadoAt?: string;
}

export type CreateSolicitudDespachoInput = Pick<SolicitudDespachoBodega, 'bodegaOrigen' | 'fechaRequerida' | 'items'> & {
  nota?: string;
};
