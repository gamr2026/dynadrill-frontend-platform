/** Guía de remisión del contenedor `comercial` (`/api/comercial/pedidos/:id/guias` y `/api/comercial/guias/:id`). */

export const PERMISOS_GUIAS = {
  ver: 'comercial.guias.ver',
  emitir: 'comercial.guias.emitir',
  firmar: 'comercial.guias.firmar',
  solicitarDespacho: 'comercial.despachos.solicitar',
  realizarDespacho: 'inventario.despachos.gestionar',
  crearTransporte: 'catalogos.transporte.crear',
} as const;

export const MODULO_ARCHIVO_GUIA = 'guia_documento';
/** Documento de respaldo y hoja MSDS del despacho a Bodega. */
export const MODULO_ARCHIVO_DESPACHO = 'despacho_documento';

export type EstadoGuia = 'emitida' | 'anulada';
export type OrigenItemGuia = 'herramienta' | 'material' | 'manual';

export interface ItemGuia {
  orden?: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  serie: string | null;
  origen: OrigenItemGuia;
}

export type EstadoFirmaElectronica = 'sin_firmas_digitales' | 'verificado' | 'verificado_con_advertencias' | 'firmantes_no_verificados' | 'alterado';
export type IntegridadFirmaDigital = 'intacto' | 'intacto_con_revisiones_posteriores' | 'modificado_despues_de_firmar' | 'firma_invalida';

export interface FirmaDigitalGuia {
  firmanteNombre: string | null;
  firmanteIdentificacion: string | null;
  emisor: string | null;
  integridad: IntegridadFirmaDigital;
  firmaValida: boolean;
  firmanteVerificado: boolean;
  vigenteAlFirmar: boolean | null;
  fechaFirma: string | null;
  origenFecha: 'sello_de_tiempo' | 'declarada_por_el_firmante' | 'desconocida';
  conclusion: string;
}

/** Validación criptográfica de las firmas digitales del PDF firmado: ayuda para revisar (sin revocación). */
export interface FirmaElectronicaGuia {
  estado: EstadoFirmaElectronica;
  resumen: string | null;
  at: string | null;
  firmas: FirmaDigitalGuia[];
}

/** Lectura de la firma manuscrita (OpenCV y Tesseract): ayuda para revisar, no certifica. `at` null = sin resultado aún. */
export interface FirmaManuscritaGuia {
  verificacion: 'no_verificada' | 'firma_detectada' | 'firma_no_detectada' | 'no_concluyente';
  confianza: number | null;
  at: string | null;
}

export interface Guia {
  id: string;
  pedidoId: string;
  numero: number;
  codigo: string;
  estado: EstadoGuia;
  fecha: string;
  clienteNombre: string | null;
  clienteRuc: string | null;
  lugarOrigen: { id: string; nombre: string };
  solicitadoPorNombre: string | null;
  despachadoPorNombre: string | null;
  horaSalida: string | null;
  horaLlegada: string | null;
  transportista: { id: string; nombre: string; identificacion: string };
  vehiculo: { id: string | null; placa: string | null; descripcion: string | null } | null;
  chofer: { id: string | null; nombre: string | null } | null;
  observaciones: string | null;
  reemplazaAId: string | null;
  emitidaAt: string;
  anulacion: { at: string; motivo: string | null } | null;
  firmada: { archivoId: string; archivoNombre: string | null; at: string | null } | null;
  firmaManuscrita: FirmaManuscritaGuia;
  /** Autorización del SRI del bloque de guías (se imprime en el formato). */
  autorizacion: { numero: string | null; desde: string | null; hasta: string | null };
  firmaElectronica: FirmaElectronicaGuia | null;
  items: ItemGuia[];
}

export interface LugarDespacho {
  id: string;
  nombre: string;
}

export interface DespachoEstado {
  solicitado: { at: string; por: string | null } | null;
  realizado: {
    at: string;
    por: string | null;
    respaldo: { id: string; nombre: string } | null;
    msds: { id: string; nombre: string } | null;
  } | null;
}

export interface RealizarDespachoRequest {
  archivoRespaldoId: string;
  archivoMsdsId?: string;
}

export interface EmitirGuiaRequest {
  fecha: string;
  lugarOrigenId: string;
  transportistaId: string;
  vehiculoId?: string;
  choferId?: string;
  solicitadoPorNombre?: string;
  despachadoPorNombre?: string;
  horaSalida?: string;
  horaLlegada?: string;
  observaciones?: string;
  numero?: number;
  reemplazaAId?: string;
  items: Array<{ codigo?: string; descripcion: string; cantidad: number; unidad: string; serie?: string; origen: OrigenItemGuia }>;
}

export const ESTADO_GUIA_LABELS: Record<EstadoGuia, string> = { emitida: 'Emitida', anulada: 'Anulada' };
export const ORIGEN_ITEM_LABELS: Record<OrigenItemGuia, string> = { herramienta: 'Herramienta', material: 'Material', manual: 'Agregado' };

const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Fila editable de la guía (los números se escriben como texto en la pantalla). */
export interface FilaGuia {
  codigo: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  serie: string;
  origen: OrigenItemGuia;
}

export const filaDesdeItem = (i: ItemGuia): FilaGuia => ({
  codigo: i.codigo ?? '',
  descripcion: i.descripcion,
  cantidad: String(i.cantidad),
  unidad: i.unidad,
  serie: i.serie ?? '',
  origen: i.origen,
});

export const filaVacia = (): FilaGuia => ({ codigo: '', descripcion: '', cantidad: '1', unidad: 'Unidad', serie: '', origen: 'manual' });

export interface BorradorGuia {
  fecha: string | null;
  lugarOrigenId: string | null;
  transportistaId: string | null;
  vehiculoId: string | null;
  choferId: string | null;
  solicitadoPorNombre: string;
  despachadoPorNombre: string;
  horaSalida: string;
  horaLlegada: string;
  observaciones: string;
  numero: string;
  filas: FilaGuia[];
}

/** Primer problema del borrador (mensaje para la persona) o `null` si se puede emitir. */
export function validarGuia(b: BorradorGuia): string | null {
  if (!b.fecha) return 'Indique la fecha de la guía.';
  if (!b.lugarOrigenId) return 'Elija el lugar de origen.';
  if (!b.transportistaId) return 'Elija el transportista.';
  if (b.horaSalida.trim() && !HORA.test(b.horaSalida.trim())) return 'La hora de salida debe ser HH:mm (por ejemplo 07:30).';
  if (b.horaLlegada.trim() && !HORA.test(b.horaLlegada.trim())) return 'La hora de llegada debe ser HH:mm (por ejemplo 15:00).';
  if (b.numero.trim() && !/^[1-9]\d{0,6}$/.test(b.numero.trim())) return 'El número de la guía debe tener hasta 7 dígitos.';
  if (!b.filas.length) return 'La guía necesita al menos un ítem.';
  for (const [i, f] of b.filas.entries()) {
    if (!f.descripcion.trim()) return `El ítem ${i + 1} necesita una descripción.`;
    const c = Number(f.cantidad.replace(',', '.'));
    if (!Number.isFinite(c) || c <= 0) return `El ítem ${i + 1} necesita una cantidad mayor que cero.`;
    if (!f.unidad.trim()) return `El ítem ${i + 1} necesita una unidad.`;
  }
  return null;
}

export function armarEmision(b: BorradorGuia, reemplazaAId?: string): EmitirGuiaRequest {
  const opc = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    fecha: b.fecha as string,
    lugarOrigenId: b.lugarOrigenId as string,
    transportistaId: b.transportistaId as string,
    vehiculoId: b.vehiculoId ?? undefined,
    choferId: b.choferId ?? undefined,
    solicitadoPorNombre: opc(b.solicitadoPorNombre),
    despachadoPorNombre: opc(b.despachadoPorNombre),
    horaSalida: opc(b.horaSalida),
    horaLlegada: opc(b.horaLlegada),
    observaciones: opc(b.observaciones),
    numero: b.numero.trim() ? Number(b.numero.trim()) : undefined,
    reemplazaAId,
    items: b.filas.map(f => ({
      codigo: opc(f.codigo),
      descripcion: f.descripcion.trim(),
      cantidad: Number(f.cantidad.replace(',', '.')),
      unidad: f.unidad.trim(),
      serie: opc(f.serie),
      origen: f.origen,
    })),
  };
}

export const ESTADO_FIRMA_ELECTRONICA: Record<EstadoFirmaElectronica, { texto: string; tono: 'success' | 'warning' | 'error' | 'neutral' }> = {
  verificado: { texto: 'Firma electrónica verificada', tono: 'success' },
  verificado_con_advertencias: { texto: 'Firma electrónica verificada con advertencias', tono: 'warning' },
  firmantes_no_verificados: { texto: 'Documento íntegro; firmante no verificado', tono: 'warning' },
  alterado: { texto: 'Documento alterado después de firmar', tono: 'error' },
  sin_firmas_digitales: { texto: 'El PDF no tiene firma electrónica', tono: 'neutral' },
};

export const AVISO_FIRMA_ELECTRONICA =
  'Validación automática de la firma electrónica del PDF: comprueba que el documento no cambió y que el certificado estaba vigente. No consulta la revocación y, si la entidad certificadora no está cargada, el firmante sale como no verificado. Es una ayuda para revisar.';

/** La validación de firma electrónica solo aplica a PDF (una imagen o un escaneo no la lleva). */
export const esPdfFirmado = (g: Pick<Guia, 'firmada'>): boolean => (g.firmada?.archivoNombre ?? '').toLowerCase().endsWith('.pdf');

/** ¿Falta algún resultado de las validaciones automáticas del archivo firmado? */
export const validacionPendiente = (g: Pick<Guia, 'estado' | 'firmada' | 'firmaManuscrita' | 'firmaElectronica'>): boolean =>
  g.estado === 'emitida' && !!g.firmada && (!g.firmaManuscrita.at || (esPdfFirmado(g) && !g.firmaElectronica));

export type AccionGuia = 'reasignar' | 'anular' | 'firmada';

export function mensajeErrorGuia(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown } } | null;
  const m = e?.error?.message;
  const texto = Array.isArray(m) ? m.filter(x => typeof x === 'string').join('. ') : typeof m === 'string' ? m : '';
  if (e?.status === 409) return texto || 'La operación entra en conflicto con el estado actual de la guía.';
  return texto || porDefecto;
}
