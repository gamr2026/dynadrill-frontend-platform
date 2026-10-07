import type { DocumentoOperativo, DocumentoRealPedido } from '../../features/facturacion/models/documento-operativo.model';
import type { Pedido } from '../../features/facturacion/models/pedido.model';
import type { FirmaCliente, Prefactura } from '../../features/facturacion/models/prefactura.model';

export type LineaTicketPrefactura = 'pumping' | 'fcr';

/**
 * Lo que ve el Supervisor al abrir "Ver prefactura" desde su ticket: la prefactura vigente del pedido o, si todavía no existe,
 * una PRELIMINAR calculada al vuelo (`preliminar: true`, `prefactura.code === 'PRELIMINAR'`) con lo cotizado y los documentos
 * generados hasta el momento — más los documentos de respaldo y si ya se puede registrar la firma del Company Man.
 */
export interface TicketPrefacturaVista {
  pedido: Pedido;
  prefactura: Prefactura;
  preliminar: boolean;
  ticketCerrado: boolean;
  /** El ticket está en su etapa final (revisión final / cierre) o terminado: ahí se gestiona la firma del Company Man. */
  enCierre: boolean;
  /** Etapa final del ticket + documentación completa + prefactura sin firmar. */
  puedeFirmar: boolean;
  /** Por qué todavía no se puede firmar (documentación incompleta), si aplica. */
  motivoNoFirma: string | null;
  firmaCompanyMan: (FirmaCliente & { origen?: string; registradaPor?: string; archivo?: string }) | null;
  documentosReales: DocumentoRealPedido[];
  /** Reporte Job y Reporte de Herramientas — para abrir sus hojas. */
  documentosOperativos: DocumentoOperativo[];
}
