import type { ItemEstimado } from '../../../facturacion/models/pedido.model';

/**
 * "El operador dispone todo el tiempo de una opción para visualizar y
 * solicitar la edición de los ítems del pedido ya definido por Ventas" — el
 * Operador propone (`itemsPropuestos`), el Supervisor aprueba o rechaza desde
 * su pestaña de Aprobaciones. Al aprobar, `Pedido.itemsEstimados` se
 * sobreescribe con `itemsPropuestos` — Facturación/Ventas ven el cambio ya
 * autorizado sin pasos adicionales.
 */
export type EstadoSolicitudCambioItems = 'pendiente' | 'aprobada' | 'rechazada';

export interface SolicitudCambioItems {
  id: number;
  pumpingTicketId: number;
  pedidoId: number;
  estado: EstadoSolicitudCambioItems;
  ticketCode: string;
  pedidoCode: string;
  cliente: string;
  itemsOriginales: ItemEstimado[];
  itemsPropuestos: ItemEstimado[];
  motivo: string;
  solicitadoPor: string;
  fechaSolicitud: string;
  revisadoPor?: string;
  fechaRevision?: string;
  motivoRechazo?: string;
}

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitudCambioItems, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};
