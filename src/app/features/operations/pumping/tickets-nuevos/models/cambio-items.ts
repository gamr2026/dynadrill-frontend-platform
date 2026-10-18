/**
 * Cambio de ítems del pedido desde Pumping (contrato 4.13): el Operador del equipo propone la lista que debe quedar en el pedido, el
 * Supervisor del ticket la aprueba o la rechaza y Comercial la aplica con los precios de su lista.
 */

export const PERMISO_CAMBIOS_SOLICITAR = 'pumping.cambios_items.solicitar';
export const PERMISO_CAMBIOS_APROBAR = 'pumping.cambios_items.aprobar';

export type TipoLineaItem = 'servicio' | 'material' | 'herramienta' | 'movilizacion';
export type EstadoSolicitudItems = 'pendiente' | 'aprobada' | 'rechazada';
/** Respuesta de Comercial a una solicitud aprobada. */
export type AplicacionCambioItems = 'pendiente' | 'aplicada' | 'no_aplicada';

/** Un ítem del pedido (sin precio: lo pone Comercial con su lista). */
export interface ItemCambio {
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  descuentoPct: number | null;
  tipoLinea: TipoLineaItem;
}

/** Un ítem elegible de la lista de precios del cliente. */
export interface OpcionItem {
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  tipo: 'Material' | 'Servicio';
}

/** Lo que Comercial tiene hoy en el pedido y, si se buscó, los ítems elegibles. */
export interface ItemsParaCambio {
  /** El pedido puede tener ítems sin enlace a la lista (los de AS2): `listaPreciosItemId` nulo. */
  actuales: Array<Omit<ItemCambio, 'listaPreciosItemId'> & { listaPreciosItemId: string | null }>;
  opciones: OpcionItem[];
}

export interface SolicitudCambioItems {
  id: string;
  ticketId: string;
  estado: EstadoSolicitudItems;
  motivo: string;
  solicitadoPor: { id: string; nombre: string };
  solicitadoAt: string;
  revisadoPor: { id: string; nombre: string } | null;
  revisadoAt: string | null;
  motivoRechazo: string | null;
  aplicacion: AplicacionCambioItems | null;
  aplicacionMotivo: string | null;
  aplicadaAt: string | null;
  items: ItemCambio[];
  /** Solo en la bandeja de aprobaciones. */
  ticket?: { id: string; numero: number | null; pedidoId: string; pedidoCodigo: string; cliente: string | null };
}

export interface ProponerCambioEntrada {
  motivo: string;
  items: Array<{
    listaPreciosItemId: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    descuentoPct?: number;
    tipoLinea: TipoLineaItem;
  }>;
}

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitudItems, string> = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
export const ESTADO_SOLICITUD_TONO: Record<EstadoSolicitudItems, 'warning' | 'success' | 'error'> = { pendiente: 'warning', aprobada: 'success', rechazada: 'error' };

/** Qué pasó con el cambio después de aprobarlo (texto para quien lo propuso); `null` si no corresponde. */
export function etiquetaAplicacion(s: Pick<SolicitudCambioItems, 'estado' | 'aplicacion' | 'aplicacionMotivo'>): string | null {
  if (s.estado !== 'aprobada') return null;
  if (s.aplicacion === 'aplicada') return 'Aplicado en el pedido';
  if (s.aplicacion === 'no_aplicada') return `No se pudo aplicar: ${s.aplicacionMotivo ?? 'Comercial lo rechazó'}`;
  return 'Esperando a que Facturación lo aplique';
}

export type CambioDeItem =
  | { tipo: 'nuevo'; item: ItemCambio }
  | { tipo: 'quitado'; item: ItemCambio }
  | { tipo: 'cantidad'; item: ItemCambio; antes: number }
  | { tipo: 'descuento'; item: ItemCambio; antes: number | null };

/**
 * Lo que cambia entre los ítems de hoy y los propuestos (por ítem de la lista de precios). Los ítems actuales sin enlace a la lista no
 * se comparan: no se pueden proponer, así que quedarían como «quitados» aunque nadie los haya tocado.
 */
export function compararItems(actuales: ItemsParaCambio['actuales'], propuestos: readonly ItemCambio[]): CambioDeItem[] {
  const hoy = new Map(actuales.filter(a => a.listaPreciosItemId).map(a => [a.listaPreciosItemId as string, a as ItemCambio]));
  const cambios: CambioDeItem[] = [];
  for (const p of propuestos) {
    const a = hoy.get(p.listaPreciosItemId);
    if (!a) cambios.push({ tipo: 'nuevo', item: p });
    else {
      if (a.cantidad !== p.cantidad) cambios.push({ tipo: 'cantidad', item: p, antes: a.cantidad });
      if ((a.descuentoPct ?? null) !== (p.descuentoPct ?? null)) cambios.push({ tipo: 'descuento', item: p, antes: a.descuentoPct ?? null });
    }
  }
  const ids = new Set(propuestos.map(p => p.listaPreciosItemId));
  for (const [id, a] of hoy) if (!ids.has(id)) cambios.push({ tipo: 'quitado', item: a });
  return cambios;
}

/** Qué falta para enviar la propuesta (texto para quien opera); `null` si se puede enviar. */
export function validarCambio(motivo: string, items: readonly Pick<ItemCambio, 'cantidad' | 'descuentoPct'>[], hayCambios: boolean): string | null {
  if (!items.length) return 'El pedido debe quedar con al menos un ítem.';
  if (items.some(i => !(i.cantidad > 0))) return 'La cantidad de cada ítem debe ser mayor que cero.';
  if (items.some(i => i.descuentoPct !== null && (i.descuentoPct < 0 || i.descuentoPct > 100))) return 'El descuento va entre 0 y 100.';
  if (!hayCambios) return 'No hay cambios respecto a lo que tiene el pedido.';
  if (motivo.trim().length < 3) return 'Escriba el motivo del cambio.';
  return null;
}
