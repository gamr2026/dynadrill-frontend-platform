import type { VerificacionFirma } from './prefactura-comercial';

export type TipoDocumentoRespaldo = 'monitoreo' | 'mezcla_quimica';

/** Módulo de `archivos` de la versión firmada del monitoreo o de la mezcla química. */
export const MODULO_ARCHIVO_FIRMADO = 'documento_respaldo_firmado';

/** Versión firmada vigente de un documento del ticket, con el resultado de la lectura automática de la firma. */
export interface DocumentoFirmado {
  id: string;
  tipo: TipoDocumentoRespaldo;
  /** El documento del ticket de Pumping al que corresponde. */
  documentoTicketId: string;
  fecha: string | null;
  archivoId: string;
  archivoNombre: string;
  verificacion: VerificacionFirma;
  verificacionConfianza: number | null;
  verificacionAt: string | null;
  cargadoAt: string;
}

export interface CargarDocumentoFirmadoRequest {
  tipo: TipoDocumentoRespaldo;
  documentoTicketId: string;
  fecha?: string;
  archivoId: string;
}
