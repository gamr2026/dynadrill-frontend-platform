import type { EstadoPrefactura } from './prefactura-comercial';

/** Prefactura vigente de un pedido en la reportería (la rechazada o anulada no cuenta). */
export interface PrefacturaReporteria {
  id: string;
  estado: EstadoPrefactura;
  version: number;
  subtotal: number;
  netoCobrar: number;
  generadaAt: string;
  firmadaAt: string | null;
}

/** Una fila por pedido (sin borradores) de `GET /comercial/reporteria/pedidos`: de aquí salen todos los cortes de la reportería. */
export interface FilaReporteria {
  pedidoId: string;
  codigo: string | null;
  ticketNumero: number | null;
  clienteNombre: string | null;
  lineaServicio: string | null;
  tipoOt: 'venta' | 'servicio' | null;
  /** Nombres de los tipos de servicio del pedido (puede tener más de uno). */
  tiposServicio: string[];
  campoNombre: string | null;
  bloqueNombre: string | null;
  pozoNombre: string | null;
  taladroNombre: string | null;
  fechaInicioServicio: string | null;
  fechaFinServicio: string | null;
  analistaNombre: string | null;
  agenteComercialNombre: string | null;
  representanteCampoNombre: string | null;
  representanteQuitoNombre: string | null;
  estado: string;
  estadoNombre: string;
  descripcionBreve: string | null;
  /** Lo cotizado por Ventas: la suma neta de los ítems del pedido. */
  cotizado: number;
  ordenTrabajoNumero: number | null;
  guiaCodigo: string | null;
  /** Última vez que el pedido llegó a cada hito del seguimiento (ISO), o null. */
  documentosCompletosAt: string | null;
  enviadoParaFirmasAt: string | null;
  ticketFirmadoAt: string | null;
  prefactura: PrefacturaReporteria | null;
}
