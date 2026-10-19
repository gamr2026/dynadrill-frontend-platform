/**
 * Permiso de Trabajo (PTW, HSE-SITIO-001) del contenedor `qhse` (`/api/v2/qhse/ptw`). Uno vigente por pedido y día de operación.
 * Fases: gabinete (se reúnen el formato de recepción, el ART vigente ese día, el PT del día y el SFI) → formalización (PTW firmado en
 * sitio, acta de recibimiento y barricadas) → aprobación (la hace QHSE) → aprobado. Un ART vencido bloquea.
 */

export const PERMISO_PTW_VER = 'qhse.ptw.ver';
export const PERMISO_PTW_GESTIONAR = 'qhse.ptw.gestionar';
export const PERMISO_PTW_APROBAR = 'qhse.ptw.aprobar';

export type FasePtw = 'gabinete' | 'formalizacion' | 'aprobacion' | 'aprobado';
export type TipoFirmaPtw = 'ptw_en_sitio' | 'acta_recibimiento' | 'barricadas' | 'aprobacion';
export type TipoConfirmacion = Exclude<TipoFirmaPtw, 'aprobacion'>;
export type AccionPtw = 'abierto' | 'documentos_validados' | 'firmado' | 'aprobado' | 'anulado';

export const FASES_PTW: FasePtw[] = ['gabinete', 'formalizacion', 'aprobacion', 'aprobado'];
export const PASOS_PTW = ['Gabinete', 'Formalización', 'Aprobación'];

export const FASE_PTW_ETIQUETA: Record<FasePtw, string> = {
  gabinete: 'Gabinete',
  formalizacion: 'Formalización',
  aprobacion: 'Por aprobar',
  aprobado: 'Aprobado',
};

export const CONFIRMACION_ETIQUETA: Record<TipoFirmaPtw, string> = {
  ptw_en_sitio: 'PTW firmado en sitio',
  acta_recibimiento: 'Acta de recibimiento firmada',
  barricadas: 'Barricadas instaladas',
  aprobacion: 'Aprobación de QHSE',
};

export const CONFIRMACIONES: TipoConfirmacion[] = [
  'ptw_en_sitio',
  'acta_recibimiento',
  'barricadas',
];

export const ACCION_PTW_ETIQUETA: Record<AccionPtw, string> = {
  abierto: 'PTW abierto',
  documentos_validados: 'Documentos validados',
  firmado: 'Formalización completa',
  aprobado: 'Aprobado por QHSE',
  anulado: 'Anulado',
};

export interface PtwResumen {
  id: string;
  numero: number;
  codigo: string;
  ticketId: string;
  ticketNumero: number | null;
  pedidoId: string;
  pedidoCodigo: string;
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  diaOperacion: string;
  fase: FasePtw;
  anulado: boolean;
}

export interface RequisitoGabinete {
  tipo: 'formato_recepcion' | 'art' | 'pt' | 'sfi';
  nombre: string;
  documentoId: string | null;
  archivoId: string | null;
  falta: string | null;
}

/** Matriz IPERC aprobada y vigente que respalda el PTW (una por actividad que exige el tipo de servicio del ticket). */
export interface RequisitoIperc {
  actividadId: string;
  actividad: string;
  matrizId: string | null;
  codigo: string | null;
  vigenteHasta: string | null;
  falta: string | null;
}

export interface FirmaPtw {
  tipo: TipoFirmaPtw;
  nombre: string;
  firmadoAt: string;
}

export interface PtwDetalle extends Omit<PtwResumen, 'anulado'> {
  supervisor: { id: string; nombre: string } | null;
  requisitos: RequisitoGabinete[];
  matricesIperc: RequisitoIperc[];
  gabineteCompleta: boolean;
  firmas: FirmaPtw[];
  anulado: boolean;
  anuladoAt: string | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
  abiertoPor: string;
  createdAt: string;
  historial: { accion: AccionPtw; motivo: string | null; actor: string; at: string }[];
}

/** Posición del paso actual en el avance (0 gabinete, 1 formalización, 2 aprobación; el aprobado queda al final). */
export function pasoDe(fase: FasePtw): number {
  return Math.min(FASES_PTW.indexOf(fase), PASOS_PTW.length - 1);
}

/** Confirmaciones de la formalización que aún faltan. */
export function confirmacionesPendientes(p: Pick<PtwDetalle, 'firmas'>): TipoConfirmacion[] {
  return CONFIRMACIONES.filter((c) => !p.firmas.some((f) => f.tipo === c));
}

/** Lo que impide pasar de gabinete a formalización, en las frases del servidor (vacío = se puede). */
export function faltantesDeGabinete(
  p: Pick<PtwDetalle, 'requisitos'> & Partial<Pick<PtwDetalle, 'matricesIperc'>>,
): string[] {
  return [
    ...p.requisitos.filter((r) => r.documentoId === null).map((r) => r.falta ?? r.nombre),
    ...(p.matricesIperc ?? [])
      .filter((m) => m.matrizId === null)
      .map((m) => m.falta ?? m.actividad),
  ];
}

/** Qué acción de avance corresponde hoy y a qué permiso; `null` si el PTW está cerrado o anulado. */
export function siguienteAccion(
  p: Pick<PtwDetalle, 'fase' | 'anulado'>,
): 'validar' | 'confirmar' | 'aprobar' | null {
  if (p.anulado) return null;
  if (p.fase === 'gabinete') return 'validar';
  if (p.fase === 'formalizacion') return 'confirmar';
  if (p.fase === 'aprobacion') return 'aprobar';
  return null;
}
