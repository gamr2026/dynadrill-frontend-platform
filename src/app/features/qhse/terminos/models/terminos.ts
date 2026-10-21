/** Versiones de los términos y condiciones de uso de equipos (Pumping). QHSE valida el texto o publica una versión nueva (D9). */
export const PERMISO_TERMINOS_VALIDAR = 'pumping.terminos.validar';

export interface VersionTerminos {
  codigo: string;
  titulo: string;
  texto: string;
  textoHash: string;
  vigente: boolean;
  publicadoAt: string;
  /** `false` = borrador: QHSE todavía no validó el texto. */
  validada: boolean;
  validadoAt: string | null;
  validadoPor: string | null;
}
