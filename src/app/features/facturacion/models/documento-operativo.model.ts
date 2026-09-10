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
  completo: boolean;
}
