import type { PumpingUnitReport } from '../../operations/pumping/models/pumping.model';
/**
 * Fase 0 / Fase 3 — Documentos operativos que llenan los operadores en
 * **FCR** y **Pumping** y que Facturación **recibe** vinculados al Pedido.
 *
 * - FCR aporta Reporte Job (`actividades`) y Reporte de Herramientas
 *   (`herramientas` + `usoHerramientas`, O/S/D/V).
 * - Pumping aporta solo Reporte Job.
 *
 * El contenido se guarda denormalizado del lado de Facturación: cuando el
 * operador firma en FCR/Pumping, ese módulo "empuja" el documento acá.
 */

import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
  OperativoToolRef,
  OperativoToolUsageEntry,
} from '../../../shared/models/operativo-docs.model';

export type OrigenOperativo = 'fcr' | 'pumping';

export type TipoDocumentoOperativo = 'reporte_job' | 'reporte_herramientas';

export const TIPO_DOCUMENTO_OPERATIVO_LABELS: Record<TipoDocumentoOperativo, string> = {
  reporte_job: 'Reporte Job',
  reporte_herramientas: 'Reporte de Herramientas',
};

export type EstadoDocumentoOperativo = 'borrador' | 'firmado' | 'recibido';

export interface DocumentoOperativo {
  id: number;
  pedidoId: number;
  origen: OrigenOperativo;
  /** Id del ticket FCR / Pumping del que proviene. */
  ticketOperativoId: number;
  tipo: TipoDocumentoOperativo;
  /** Día operativo reportado — para `reporte_job` que se llena por día. */
  fecha?: string;
  estado: EstadoDocumentoOperativo;
  firmadoPor?: string;
  firmadoAt?: string;
  recibidoAt?: string;

  header?: OperativoDocHeader;
  /** reporte_job */
  actividades?: OperativoActivityLogEntry[];
  /** reporte_herramientas */
  herramientas?: OperativoToolRef[];
  usoHerramientas?: OperativoToolUsageEntry[];
}

export type PushDocumentoOperativoInput = Omit<DocumentoOperativo, 'id' | 'pedidoId' | 'estado' | 'recibidoAt'> & {
  /** El módulo operativo conoce el código de pedido, no el id interno de Facturación. */
  pedidoCode: string;
};

/**
 * Resumen de avance documental de un Pedido — habilita "Generar prefactura"
 * cuando `completo`. La Guía de Remisión es **requisito previo** a generar
 * la prefactura (no posterior al envío al cliente) cuando el Reporte de
 * Herramientas ya registró ítems tipo venta (Material).
 */
export interface AvanceDocumental {
  pedidoId: number;
  reporteJobDias: number;
  reporteJobDiasEsperados: number;
  reporteHerramientasAplica: boolean;
  reporteHerramientasAlDia: boolean;
  materialesRegistrados: boolean;
  guiaRemisionAplica: boolean;
  guiaRemisionGenerada: boolean;
  /** HSE-SITIO-001: el servicio abrió al menos un PTW y falta cerrarlo (bloquea la prefactura, FACT-002/004). */
  ptwAplica?: boolean;
  ptwsCerrados?: boolean;
  ptwSinAbrir?: boolean;
  /** HSE-AMBIENTAL-002: derrames registrados durante el servicio (alerta, no bloquea — FACT-002). */
  incidentesHse?: number;
  /** Solo aplica a Pumping — documento de monitoreo (subida real a disco por día, ver PumpingDocumentosService). Informativo: no bloquea "Generar prefactura". */
  monitoreoAplica?: boolean;
  monitoreoDocsCargados?: number;
  /** Documentos de respaldo reales (archivo en disco, no solo un nombre) recuperables desde Facturación — monitoreo y mezcla de químicos. */
  documentosReales?: DocumentoRealPedido[];
  /** `true` cuando TODOS los `documentosReales` ya tienen su versión firmada subida — condición para habilitar "Enviar al cliente" (ver `puedeEnviar` en prefactura-detail-page.ts). */
  documentosFirmadosCompletos?: boolean;
  /** Reporte de Unidad del ticket de Pumping (salida y, si ya se hizo, llegada) — se baja como PDF (formato DYN-MNT-RE-012). Null si aún no hay reporte de salida. */
  reporteUnidad?: PumpingUnitReport | null;
  ticketPumpingCode?: string | null;
  ticketPumpingId?: number | null;
  ticketPumpingFase?: string | null;
  completo: boolean;
}

/** Un documento de respaldo real (monitoreo o mezcla) — ver `AvanceDocumental.documentosReales`. */
export interface DocumentoRealPedido {
  tipo: 'monitoreo' | 'mezcla' | 'reporte_job' | 'reporte_herramientas' | 'prefactura' | 'despacho_bodega';
  /** `pumping` = archivo subido en el ticket de Pumping (`PumpingDocumento`, requiere `ticketId`+`campo` para descargarlo). `pedido` = archivo que Ventas adjuntó al crear el Pedido (`PedidoDocumento`, requiere `pedidoDocumentoId`). `generado` = Reporte Job/Herramientas/Prefactura/Despacho de Bodega — para los 3 primeros "Descargar" arma el PDF al vuelo (jsPDF) en vez de pedirlo al backend; Despacho de Bodega es la única excepción con archivo real detrás (el que Bodega adjuntó al despachar, ver `descargarDocumentoReal` en pedido-detail-page.ts). */
  origen: 'pumping' | 'pedido' | 'generado';
  nombreOriginal: string;
  fecha: string;
  ticketId?: number;
  campo?: string;
  pedidoDocumentoId?: number;
  /** Clave para `POST/GET/DELETE :id/documentos-firmados/:tipo/:referencia` — mismo valor que `campo` o `pedidoDocumentoId` como texto. */
  referencia: string;
  /** `true` si Facturación ya subió la versión firmada de este documento puntual. */
  firmado: boolean;
}
