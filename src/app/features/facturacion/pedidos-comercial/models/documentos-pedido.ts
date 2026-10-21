/** Archivo subido al módulo de archivos de plataforma (`POST /api/archivos`). */
export interface ArchivoSubido {
  id: string;
  modulo: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  sha256: string;
  escaneado: boolean;
  subidoPor: string | null;
  createdAt: string;
}

/** Adjunto de un pedido (`PedidoDetalle.documentos`). `id` es el id del adjunto (sirve para quitarlo). */
export interface DocumentoPedido {
  id: string;
  archivoId: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  subidoPor: string | null;
  createdAt: string;
}

export const MODULO_ARCHIVO_PEDIDO = 'pedido_documento';
export const MAX_BYTES_DOCUMENTO = 10 * 1024 * 1024;
export const MAX_DOCUMENTOS_PEDIDO = 10;

export const TIPOS_DOCUMENTO_ADMITIDOS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
};

/** Extensiones admitidas, por si el navegador no informa el tipo MIME. */
const EXTENSIONES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Valor para el atributo `accept` del input de archivo. */
export const ACCEPT_DOCUMENTOS = Object.keys(EXTENSIONES)
  .map((e) => `.${e}`)
  .join(',');

/** Tamaño legible: 512 B, 1,5 KB, 3,2 MB. */
export function formatoTamano(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(1).replace('.', ',')} ${unidades[i]}`;
}

/** Valida tipo y tamaño antes de subir. Devuelve el mensaje (con "usted") o `null` si es válido. */
export function errorDeArchivo(
  archivo: { name: string; size: number; type: string },
  adjuntosActuales: number,
): string | null {
  if (adjuntosActuales >= MAX_DOCUMENTOS_PEDIDO)
    return `El pedido ya tiene el máximo de ${MAX_DOCUMENTOS_PEDIDO} documentos. Quite alguno antes de adjuntar otro.`;
  if (archivo.size <= 0) return 'El archivo está vacío. Elija otro archivo.';
  if (archivo.size > MAX_BYTES_DOCUMENTO)
    return `El archivo pesa ${formatoTamano(archivo.size)} y el máximo es ${formatoTamano(MAX_BYTES_DOCUMENTO)}.`;
  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeAdmitido = archivo.type in TIPOS_DOCUMENTO_ADMITIDOS;
  // Algunos navegadores no informan el tipo de un DOCX/XLSX: en ese caso se confía en la extensión (el backend revisa el contenido).
  const sinTipo = archivo.type === '' || archivo.type === 'application/octet-stream';
  if (!mimeAdmitido && !(sinTipo && ext in EXTENSIONES))
    return 'Tipo de archivo no admitido. Puede adjuntar PDF, PNG, JPEG, DOCX o XLSX.';
  return null;
}

/** Mensaje para el error de subida/adjuntar según el código HTTP del backend. */
export function mensajeErrorArchivo(err: unknown): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const detalle =
    typeof e?.error?.detail === 'string'
      ? e.error.detail
      : typeof e?.error?.message === 'string'
        ? e.error.message
        : Array.isArray(e?.error?.message)
          ? e.error.message.join('. ')
          : '';
  switch (e?.status) {
    case 400:
      return detalle || 'El archivo no es válido. Revise que no esté vacío.';
    case 403:
      return 'Usted no tiene permiso para adjuntar documentos.';
    case 413:
      return 'El archivo supera el tamaño máximo permitido.';
    case 415:
      return 'Tipo de archivo no admitido. Puede adjuntar PDF, PNG, JPEG, DOCX o XLSX.';
    case 422:
      return (
        detalle ||
        'El contenido del archivo no corresponde a su tipo o fue rechazado por el antivirus.'
      );
    case 503:
      return 'El antivirus no está disponible en este momento. Intente de nuevo en unos minutos.';
    default:
      return detalle || 'No se pudo completar la operación con el documento. Intente de nuevo.';
  }
}
