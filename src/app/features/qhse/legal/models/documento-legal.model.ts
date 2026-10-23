/**
 * Requisitos legales (matrices de evaluación de Gestión Ambiental y de Seguridad y Salud en el Trabajo) del contenedor `qhse`
 * (`/api/v2/qhse/legal`). Cada revisión es un registro: la vigente rige y las anteriores quedan como historia. El documento se sube antes al
 * servicio de archivos (módulo `qhse_requisito_legal`) y se enlaza por su id. Los ids son UUID (texto).
 */

export const PERMISO_LEGAL_VER = 'qhse.legal.ver';
export const PERMISO_LEGAL_GESTIONAR = 'qhse.legal.gestionar';
/** Módulo del servicio de archivos por el que se sube el documento. */
export const MODULO_ARCHIVO_REQUISITO_LEGAL = 'qhse_requisito_legal';

export type EstadoRevisionLegal = 'vigente' | 'reemplazado';
export type EstadoVigencia = 'sin_vencimiento' | 'vigente' | 'por_vencer' | 'vencido';

export const ESTADO_VIGENCIA_ETIQUETA: Record<EstadoVigencia, string> = {
  sin_vencimiento: 'Sin vencimiento',
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};
export type TonoLegal = 'success' | 'warning' | 'error' | 'neutral';
export const ESTADO_VIGENCIA_TONO: Record<EstadoVigencia, TonoLegal> = {
  sin_vencimiento: 'neutral',
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'error',
};

export interface TipoRequisitoLegal {
  id: string;
  codigo: string;
  nombre: string;
}

export interface RevisionLegal {
  id: string;
  revision: string;
  fechaAprobacion: string;
  vigenteHasta: string | null;
  estado: EstadoRevisionLegal;
  /** Solo la revisión que rige tiene vigencia evaluada; las reemplazadas ya no vencen. */
  estadoVigencia: EstadoVigencia | null;
  diasParaVencer: number | null;
  archivoId: string;
  registradoPor: string | null;
  registradoAt: string;
  reemplazadoAt: string | null;
  reemplazadoPor: string | null;
}

/** Un tipo de matriz con su revisión vigente (o `null` si aún no hay) y todas sus revisiones, de la más reciente a la más antigua. */
export interface RequisitoLegalGrupo {
  tipo: TipoRequisitoLegal;
  vigente: RevisionLegal | null;
  revisiones: RevisionLegal[];
}

export interface RegistrarRevisionLegal {
  tipoId: string;
  revision: string;
  fechaAprobacion: string;
  vigenteHasta?: string;
  archivoId: string;
}

/** Texto de la vigencia de la revisión que rige («Vence en 12 días», «Venció hace 3 días»…). */
export function textoDeVigencia(
  r: Pick<RevisionLegal, 'estadoVigencia' | 'diasParaVencer'>,
): string {
  if (!r.estadoVigencia || r.estadoVigencia === 'sin_vencimiento' || r.diasParaVencer === null)
    return ESTADO_VIGENCIA_ETIQUETA[r.estadoVigencia ?? 'sin_vencimiento'];
  const d = r.diasParaVencer;
  if (d < 0) return `Venció hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoy';
  return `Vence en ${d} día${d === 1 ? '' : 's'}`;
}
