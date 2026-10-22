/** Evidencia de firma (`/api/firmas`): quién firmó un documento, en qué papel, cuándo y con qué huella. Solo lectura. */

export const PERMISOS_FIRMAS = {
  ver: 'firmas.evidencia.ver',
  verificar: 'firmas.evidencia.verificar',
} as const;

export type MetodoFirma = 'linea' | 'electronica' | 'manuscrita';
export type ResultadoVerificacion = 'firma_detectada' | 'firma_no_detectada' | 'no_concluyente';

export interface VerificacionFirma {
  id: string;
  resultado: ResultadoVerificacion;
  /** 0 a 1; no es una probabilidad calibrada. */
  confianza: number;
  nombreCoincide: boolean | null;
  verificadaAt: string;
  solicitadaPor: { id: string; nombre: string };
}

export interface FirmaEvidencia {
  id: string;
  rolFirmante: { codigo: string; descripcion: string };
  firmante: { id: string; nombre: string };
  firmadaAt: string;
  metodo: MetodoFirma;
  /** La más reciente de ese papel; las anteriores son historia. */
  vigente: boolean;
  /** Huella SHA-256 del texto firmado, solo en la firma «de una línea». */
  hashDocumento: string | null;
  /** Archivo firmado y su huella, en las firmas manuscritas y electrónicas. */
  archivo: { id: string; nombre: string; sha256: string } | null;
  verificacion: VerificacionFirma | null;
}

export interface FirmasDeDocumento {
  documentoTipo: string;
  documentoId: string;
  firmas: FirmaEvidencia[];
}

export const METODO_ETIQUETA: Record<MetodoFirma, string> = {
  linea: 'De una línea',
  electronica: 'Electrónica',
  manuscrita: 'Manuscrita',
};

/** Texto y tono de la última lectura de la firma del archivo (es una ayuda para revisar, no certifica nada). */
export function estadoDeVerificacion(v: VerificacionFirma | null): {
  texto: string;
  tono: 'neutral' | 'success' | 'warning';
} {
  if (!v) return { texto: 'Sin verificar', tono: 'neutral' };
  switch (v.resultado) {
    case 'firma_detectada':
      return {
        texto:
          v.nombreCoincide === false ? 'Firma detectada, el nombre no coincide' : 'Firma detectada',
        tono: v.nombreCoincide === false ? 'warning' : 'success',
      };
    case 'firma_no_detectada':
      return { texto: 'No se detectó firma', tono: 'warning' };
    default:
      return { texto: 'No concluyente', tono: 'warning' };
  }
}

/** Las firmas vigentes primero (una por papel) y después la historia, cada grupo del más reciente al más antiguo. */
export function ordenarEvidencia(firmas: readonly FirmaEvidencia[]): FirmaEvidencia[] {
  return [...firmas].sort(
    (a, b) => Number(b.vigente) - Number(a.vigente) || b.firmadaAt.localeCompare(a.firmadaAt),
  );
}

/** Huella corta para mostrar («a1b2c3d4…f5e6»); la completa va en el atributo `title` y se copia. */
export function huellaCorta(sha256: string): string {
  return sha256.length > 16 ? `${sha256.slice(0, 8)}…${sha256.slice(-8)}` : sha256;
}

/** Una firma solo se verifica si es manuscrita (tiene un archivo con la firma dibujada). */
export function sePuedeVerificar(f: FirmaEvidencia): boolean {
  return f.metodo === 'manuscrita' && f.archivo !== null;
}
