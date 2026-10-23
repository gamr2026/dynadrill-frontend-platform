import type { DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';

/**
 * Desechos (HSE-AMBIENTAL-001, DYN-SGI-RE-063, AM 142) del contenedor `qhse` (`/api/v2/qhse/desechos`). Cualquier trabajador registra un
 * desecho; el equipo HSE genera el manifiesto con sus tres firmas, carga el manifiesto firmado y el certificado de disposición final. La
 * autoridad de las reglas es el backend (y la base de datos): límite de almacenamiento de 12 meses, tres firmas para disponer, etc.
 */

export const PERMISO_DESECHOS_VER = 'qhse.desechos.ver';
export const PERMISO_DESECHOS_GESTIONAR = 'qhse.desechos.gestionar';
/** Registrar un desecho es de cualquier trabajador (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';

/** Módulo del servicio de archivos por el que se suben el manifiesto firmado y el certificado. */
export const MODULO_ARCHIVO_DESECHO = 'qhse_desecho_documento';

export type ClasificacionDesecho = 'peligroso' | 'no_peligroso';

export const CLASIFICACION_ETIQUETA: Record<ClasificacionDesecho, string> = {
  peligroso: 'Peligroso',
  no_peligroso: 'No peligroso',
};

export type EstadoDesecho = 'almacenado' | 'con_manifiesto' | 'dispuesto';

export const ESTADO_DESECHO_ETIQUETA: Record<EstadoDesecho, string> = {
  almacenado: 'Almacenado',
  con_manifiesto: 'Con manifiesto',
  dispuesto: 'Dispuesto',
};

export const ESTADOS_DESECHO: EstadoDesecho[] = ['almacenado', 'con_manifiesto', 'dispuesto'];

export const ESTADO_DESECHO_TONO: Record<EstadoDesecho, DynadrillTagVariant> = {
  almacenado: 'neutral',
  con_manifiesto: 'info',
  dispuesto: 'success',
};

/** Rol de cada firma del manifiesto, con las etiquetas del formato DYN-SGI-RE-063. */
export type RolFirma = 'despachado_por' | 'transportado_por' | 'recibido_por';

export const ROL_FIRMA_ETIQUETA: Record<RolFirma, string> = {
  despachado_por: 'Despachado por',
  transportado_por: 'Transportado por',
  recibido_por: 'Recibido por',
};

export const ROL_FIRMA_ACCION: Record<RolFirma, string> = {
  despachado_por: 'Confirmar despacho',
  transportado_por: 'Confirmar transporte',
  recibido_por: 'Confirmar recepción',
};

/** El transportista y el gestor firman en papel y no tienen cuenta: se identifican con su nombre y su cédula. */
export const firmaPideFirmante = (rol: RolFirma): boolean => rol !== 'despachado_por';

export type TipoDocumentoDesecho = 'manifiesto_firmado' | 'certificado_disposicion';

export const TIPO_DOCUMENTO_ETIQUETA: Record<TipoDocumentoDesecho, string> = {
  manifiesto_firmado: 'Manifiesto firmado',
  certificado_disposicion: 'Certificado de disposición final',
};

export type VerificacionFirma =
  'no_verificada' | 'firma_detectada' | 'firma_no_detectada' | 'no_concluyente';

// ----------------------------------------------------------------------------------------------------- catálogos

export interface Caracteristica {
  id: string;
  codigo: string;
  nombre: string;
}

export interface Contenedor {
  id: string;
  codigo: string;
  nombre: string;
  uso: string;
}

export interface Pozo {
  id: string;
  codigo: string;
  nombreCompleto: string;
}

export interface CatalogosDesecho {
  caracteristicas: Caracteristica[];
  contenedores: Contenedor[];
  pozos: Pozo[];
}

/** «Rojo — biológico-infeccioso»: el nombre del color y para qué se usa (convención interna de Dynadrill). */
export function etiquetaContenedor(c: { nombre: string; uso?: string }): string {
  const uso = c.uso ? c.uso.charAt(0).toLowerCase() + c.uso.slice(1) : '';
  return uso ? `${c.nombre} — ${uso}` : c.nombre;
}

// ------------------------------------------------------------------------------------------------------- lectura

export interface DesechoResumen {
  id: string;
  numero: number;
  codigo: string;
  clasificacion: ClasificacionDesecho;
  /** Nombres de las características CRETIB (vacío si no es peligroso). */
  cretib: string[];
  /** En el detalle trae también el uso del color (en la bandeja, solo el código y el nombre). */
  contenedor: { codigo: string; nombre: string; uso?: string };
  descripcion: string;
  ubicacion: string | null;
  estado: { codigo: EstadoDesecho; nombre: string };
  /** Cantidad de líneas de la guía. */
  items: number;
  registradoAt: string;
  /** AM 142: registro + 12 meses (AAAA-MM-DD). */
  limiteAlmacenamientoHasta: string;
  /** Días que quedan al límite (negativo si ya pasó); nulo si ya fue dispuesto. */
  diasParaLimite: number | null;
  vencido: boolean;
}

export interface LineaDesecho {
  id: string;
  orden: number;
  descripcion: string;
  numeroLote: string | null;
  codigo: string;
  cantidadGalones: number;
  bultos: number;
}

export interface FirmaDesecho {
  rol: RolFirma;
  firmadoAt: string | null;
  registradoPor: string | null;
  firmanteNombre: string | null;
  firmanteCedula: string | null;
}

export interface ManifiestoDesecho {
  numero: string;
  fecha: string;
  /** Plazo de 30 días desde el manifiesto para tener el certificado de disposición final. */
  certificadoVenceEl: string;
  certificadoVencido: boolean;
  certificadoFueraDePlazo: boolean;
  gestorNombre: string;
  gestorLicenciaSuia: string;
  cliente: { nombre: string; identificacion: string } | null;
  solicitadoPor: string | null;
  transportista: {
    compania: string | null;
    conductor: string | null;
    cedulaConductor: string | null;
    vehiculo: string | null;
    placas: string | null;
  };
  horaSalida: string | null;
  horaLlegada: string | null;
  firmas: FirmaDesecho[];
  firmasCompletas: boolean;
}

export interface DocumentoDesecho {
  tipo: TipoDocumentoDesecho;
  archivoId: string;
  emitidoEl: string | null;
  referencia: string | null;
  verificacion: VerificacionFirma;
  verificacionConfianza: number | null;
  verificacionAt: string | null;
  cargadoAt: string;
}

export interface DesechoDetalle extends Omit<DesechoResumen, 'items'> {
  pozo: { codigo: string; nombre: string } | null;
  generadoPor: string | null;
  items: LineaDesecho[];
  totalGalones: number;
  /** Derrame del que salió este desecho (suelo contaminado). */
  derrame: { id: string; codigo: string } | null;
  manifiesto: ManifiestoDesecho | null;
  documentos: DocumentoDesecho[];
  historial: Array<{
    estado: { codigo: EstadoDesecho; nombre: string };
    actor: string | null;
    at: string;
  }>;
}

export interface TableroDesechos {
  porEstado: Array<{ codigo: EstadoDesecho; nombre: string; cantidad: number }>;
  vencidos: number;
  porVencer: number;
  /** Días de anticipación con que se considera «por vencer». */
  diasAviso: number;
  galonesSinDisponer: number;
}

export type FiltroVencimiento = 'vencidos' | 'por_vencer';

// ------------------------------------------------------------------------------------------------------ escritura

export interface LineaRegistro {
  descripcion: string;
  numeroLote?: string;
  codigo: string;
  cantidadGalones: number;
  bultos?: number;
}

export interface RegistrarDesecho {
  clasificacion: ClasificacionDesecho;
  contenedorId: string;
  /** Solo un desecho peligroso lleva características CRETIB. */
  caracteristicaIds?: string[];
  descripcion: string;
  pozoId?: string;
  ubicacion?: string;
  items: LineaRegistro[];
}

/** Transporte y horas de la guía de remisión (todo opcional; el transportista y las horas se completan con el manifiesto abierto). */
export interface GuiaDesecho {
  clienteId?: string;
  solicitadoPor?: string;
  transportistaCompania?: string;
  conductorNombre?: string;
  conductorCedula?: string;
  vehiculo?: string;
  placas?: string;
  horaSalida?: string;
  horaLlegada?: string;
}

export interface GenerarManifiesto extends GuiaDesecho {
  numero: string;
  gestorNombre: string;
  gestorLicenciaSuia: string;
}

// -------------------------------------------------------------------------------------------------------- ayudas

/** Total de galones de la guía, para la fila «TOTAL DESECHOS GENERADOS» del formato. */
export function totalGalones(items: Array<{ cantidadGalones: number }>): number {
  return Math.round(items.reduce((t, i) => t + i.cantidadGalones, 0) * 1000) / 1000;
}

/** Fecha AAAA-MM-DD → «dd/mm/aaaa» (sin pasar por Date: no corre el día por la zona horaria). */
export function fechaCorta(dia: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** El día de calendario local de una fecha, como lo espera el backend (AAAA-MM-DD). */
export function fechaIso(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Cuánto falta (o cuánto pasó) del límite de 12 meses de almacenamiento (AM 142). */
export function textoLimite(d: Pick<DesechoResumen, 'estado' | 'diasParaLimite'>): string {
  if (d.estado.codigo === 'dispuesto' || d.diasParaLimite === null) return '—';
  const n = d.diasParaLimite;
  if (n < 0) return `Vencido hace ${-n} ${-n === 1 ? 'día' : 'días'}`;
  if (n === 0) return 'Vence hoy';
  return `Faltan ${n} ${n === 1 ? 'día' : 'días'}`;
}

/** Insignia del límite: rojo si ya venció, ámbar si se acerca (dentro de los días de aviso), neutral en lo demás. */
export function tonoLimite(
  d: Pick<DesechoResumen, 'estado' | 'diasParaLimite' | 'vencido'>,
  diasAviso = 30,
): DynadrillTagVariant {
  if (d.estado.codigo === 'dispuesto' || d.diasParaLimite === null) return 'neutral';
  if (d.vencido) return 'error';
  return d.diasParaLimite <= diasAviso ? 'warning' : 'neutral';
}

/**
 * Lo que dice la lectura automática de la firma de un documento. Es solo un indicador para revisar: no certifica la autenticidad ni
 * bloquea nada. `pendiente` mientras el servicio aún no responde.
 */
export function lecturaDeFirma(
  d: Pick<DocumentoDesecho, 'verificacion' | 'verificacionConfianza' | 'verificacionAt'>,
): {
  texto: string;
  tono: DynadrillTagVariant;
  pendiente: boolean;
} {
  const confianza =
    d.verificacionConfianza === null ? '' : ` (${Math.round(d.verificacionConfianza * 100)} %)`;
  switch (d.verificacion) {
    case 'firma_detectada':
      return { texto: `Firma detectada${confianza}`, tono: 'success', pendiente: false };
    case 'firma_no_detectada':
      return { texto: `Firma no detectada${confianza}`, tono: 'warning', pendiente: false };
    case 'no_concluyente':
      return { texto: `Lectura no concluyente${confianza}`, tono: 'warning', pendiente: false };
    default:
      return d.verificacionAt === null
        ? { texto: 'Leyendo la firma…', tono: 'neutral', pendiente: true }
        : { texto: 'Firma sin verificar', tono: 'neutral', pendiente: false };
  }
}

/** Mensaje del plazo del certificado de disposición final (30 días desde el manifiesto); vacío si no hay nada que avisar. */
export function avisoCertificado(
  m: ManifiestoDesecho,
  dispuesto: boolean,
): { texto: string; tono: DynadrillTagVariant } | null {
  if (m.certificadoFueraDePlazo)
    return { texto: 'Certificado registrado fuera del plazo de 30 días', tono: 'warning' };
  if (dispuesto) return null;
  if (m.certificadoVencido)
    return {
      texto: `El plazo del certificado venció el ${fechaCorta(m.certificadoVenceEl)}`,
      tono: 'error',
    };
  return null;
}

/** El documento de un tipo, si ya se cargó. */
export function documentoDe(
  d: Pick<DesechoDetalle, 'documentos'>,
  tipo: TipoDocumentoDesecho,
): DocumentoDesecho | null {
  return d.documentos.find((x) => x.tipo === tipo) ?? null;
}

/** Las firmas aún sin registrar, en el orden del formato. */
export function firmasPendientes(m: ManifiestoDesecho): RolFirma[] {
  return m.firmas.filter((f) => f.firmadoAt === null).map((f) => f.rol);
}
