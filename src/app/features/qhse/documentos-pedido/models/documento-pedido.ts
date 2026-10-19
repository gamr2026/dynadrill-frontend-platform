/**
 * Documentos de seguridad por pedido del contenedor `qhse` (`/api/v2/qhse/documentos`): formato de recepción, ART, PT, SFI y Acta de
 * Entrega de Locación (DYN-PMP-RE-027). Los documentos se cargan y se anulan, nunca se editan. El ART vale 15 días desde su emisión;
 * el PT es del día de operación. Los ids son UUID (texto), a diferencia de la demo.
 */

export const PERMISO_DOCUMENTOS_VER = 'qhse.documentos.ver';
/** El equipo de Pumping ve qué documentos tiene el pedido de su ticket (solo el estado; no la bandeja ni las descargas). */
export const PERMISO_DOCUMENTOS_VER_TICKET = 'qhse.documentos.ver_ticket';
export const PERMISO_DOCUMENTOS_GESTIONAR = 'qhse.documentos.gestionar';
export const PERMISO_ACTA_ENTREGA_CARGAR = 'qhse.acta_entrega.cargar';
export const PERMISO_ACTA_ENTREGA_VER = 'qhse.acta_entrega.ver';

/** Módulos del servicio de archivos por los que se sube cada tipo (el backend verifica que el archivo venga de ahí). */
export const MODULO_ARCHIVO_ACTA = 'qhse_acta_entrega';
export const MODULO_ARCHIVO_DOCUMENTO = 'qhse_documento_pedido';

export type TipoDocumentoPedido = 'formato_recepcion' | 'art' | 'pt' | 'sfi' | 'formato_entrega';
/** Los que se cargan desde la bandeja de QHSE; el Acta tiene su propia carga, ligada al ticket. */
export type TipoDocumentoGeneral = Exclude<TipoDocumentoPedido, 'formato_entrega'>;

export const TIPO_DOCUMENTO_ETIQUETA: Record<TipoDocumentoPedido, string> = {
  formato_recepcion: 'Formato de recepción',
  art: 'ART',
  pt: 'PT',
  sfi: 'SFI',
  formato_entrega: 'Acta de Entrega de Locación',
};

export const TIPOS_GENERALES: TipoDocumentoGeneral[] = ['formato_recepcion', 'art', 'pt', 'sfi'];

export type TonoDocumento = 'success' | 'warning' | 'error' | 'neutral';
export interface InsigniaDocumento {
  text: string;
  tone: TonoDocumento;
}

export interface DocumentoVigente {
  id: string;
  archivoId: string;
}

export interface ArtVigente extends DocumentoVigente {
  emitidoEl: string | null;
  vigenteHasta: string;
  venceEnDias: number;
  vencido: boolean;
  /** Avisa 3 días antes de vencer. */
  porVencer: boolean;
}

/** Una fila de la bandeja: lo que tiene y lo que le falta a un pedido que QHSE conoce. */
export interface PedidoDocumental {
  pedidoId: string;
  pedidoCodigo: string;
  /** Copias que QHSE guarda del ticket (cliente, campo y pozo) para mostrarlas en la bandeja. */
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  creadoAt: string;
  tickets: { ticketId: string; numero: number | null }[];
  formatoRecepcion: DocumentoVigente | null;
  sfi: DocumentoVigente | null;
  actaEntrega: DocumentoVigente | null;
  ptHoy: DocumentoVigente | null;
  art: ArtVigente | null;
}

export interface DocumentoPedido {
  id: string;
  pedidoId: string;
  pedidoCodigo: string | null;
  ticketId: string | null;
  ticketNumero: number | null;
  tipo: TipoDocumentoPedido;
  archivoId: string;
  referencia: string | null;
  /** Solo el Acta: por qué la subió otra persona y no el supervisor asignado. */
  motivoSuplencia: string | null;
  fecha: string | null;
  vigenteHasta: string | null;
  vencido: boolean;
  cargadoPor: string;
  createdAt: string;
  anulado: boolean;
  anuladoAt: string | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
}

/** El Acta de un ticket (vigente y anuladas) y el supervisor asignado, para saber si quien sube es suplente. */
export interface ActaDelTicket {
  supervisorAsignado: { id: string; nombre: string } | null;
  documentos: DocumentoPedido[];
}

/** Quien sube el Acta sin ser el supervisor asignado debe decir por qué el asignado no pudo. */
export function exigeMotivoSuplencia(
  supervisorAsignadoId: string | null,
  usuarioId: string | undefined,
): boolean {
  return supervisorAsignadoId !== null && supervisorAsignadoId !== usuarioId;
}

export interface CargarDocumento {
  pedidoId: string;
  ticketId?: string;
  tipo: TipoDocumentoGeneral;
  archivoId: string;
  referencia?: string;
  fecha?: string;
}

const CARGADO: InsigniaDocumento = { text: 'Cargado', tone: 'success' };
const PENDIENTE: InsigniaDocumento = { text: 'Pendiente', tone: 'warning' };

/** Insignia de un documento que puede estar o no (formato de recepción, SFI, Acta, PT de hoy). */
export function insigniaDocumento(d: DocumentoVigente | null): InsigniaDocumento {
  return d ? CARGADO : PENDIENTE;
}

/** Insignia del ART: sin ART, vencido, por vencer (avisa 3 días antes) o vigente con los días que le quedan. */
export function insigniaArt(art: ArtVigente | null): InsigniaDocumento {
  if (!art) return { text: 'Sin ART', tone: 'neutral' };
  if (art.vencido) return { text: 'Vencido', tone: 'error' };
  if (art.porVencer) {
    return {
      text:
        art.venceEnDias === 0
          ? 'Vence hoy'
          : `Vence en ${art.venceEnDias} ${art.venceEnDias === 1 ? 'día' : 'días'}`,
      tone: 'warning',
    };
  }
  return { text: `Vigente (${art.venceEnDias} días)`, tone: 'success' };
}

/** `AAAA-MM-DD` del día local de la fecha elegida (no del UTC: a las 8 p. m. de Ecuador ya sería «mañana»). */
export function fechaIso(d: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** El ART y el PT piden fecha (emisión y día de operación); el resto no. */
export function exigeFecha(tipo: TipoDocumentoGeneral): boolean {
  return tipo === 'art' || tipo === 'pt';
}

/** Lo que falta para poder cargar, en frases para el usuario; vacío si ya se puede. */
export function pendientesDeCarga(p: {
  tipo: TipoDocumentoGeneral | null;
  fecha: Date | null;
  archivo: File | null;
}): string[] {
  const falta: string[] = [];
  if (!p.tipo) falta.push('elegir el tipo de documento');
  if (p.tipo && exigeFecha(p.tipo) && !p.fecha)
    falta.push(p.tipo === 'art' ? 'indicar la fecha de emisión' : 'indicar el día de operación');
  if (!p.archivo) falta.push('elegir el archivo');
  return falta;
}
