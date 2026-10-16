import {
  importesItem,
  totalesItems,
  type ImportesItem,
  type ItemListaCliente,
  type ItemPedido,
  type ItemPedidoRequest,
  type ItemPlantillaValidado,
} from './pedido-comercial.model';

/**
 * Línea en edición. Cantidad y descuento son texto: enlazar un número a un `<input type="number">` hace que lo tipeado
 * "no pegue" (mismo patrón que el resto del módulo). El precio es siempre el de la lista del cliente y no se edita.
 */
export interface LineaEditable {
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string | null;
  precio: number;
  cantidad: string;
  descuentoPct: string;
  origen: 'lista' | 'plantilla';
}

export const MAX_LINEAS = 300;

export function lineaDesdeLista(item: ItemListaCliente, cantidad = 1): LineaEditable {
  return {
    listaPreciosItemId: item.listaPreciosItemId,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    precio: item.precio,
    cantidad: String(cantidad),
    descuentoPct: '0',
    origen: 'lista',
  };
}

export function lineaDesdePlantilla(item: ItemPlantillaValidado): LineaEditable {
  return {
    listaPreciosItemId: item.listaPreciosItemId,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    precio: item.precioLista,
    cantidad: String(item.cantidad),
    descuentoPct: String(item.descuentoPct ?? 0),
    origen: 'plantilla',
  };
}

/** Línea ya guardada en el pedido. Devuelve `null` si perdió su vínculo con la lista de precios (no se puede reenviar). */
export function lineaDesdeItemPedido(i: ItemPedido): LineaEditable | null {
  if (!i.listaPreciosItemId) return null;
  return {
    listaPreciosItemId: i.listaPreciosItemId,
    codigo: i.codigo,
    descripcion: i.descripcion,
    unidad: i.unidad,
    precio: i.valorUnitario,
    cantidad: String(i.cantidad),
    descuentoPct: String(i.descuentoPct ?? 0),
    origen: i.origenItem === 'plantilla' ? 'plantilla' : 'lista',
  };
}

const aNumero = (t: string): number => Number(t.trim().replace(',', '.'));
const decimales = (n: number): number => {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
};

export function cantidadDe(l: LineaEditable): number {
  return aNumero(l.cantidad);
}

export function descuentoDe(l: LineaEditable): number {
  return l.descuentoPct.trim() === '' ? 0 : aNumero(l.descuentoPct);
}

/** Mensaje del primer problema de la línea (mismas reglas que el DTO del backend) o `null` si es válida. */
export function errorDeLinea(l: LineaEditable): string | null {
  const c = cantidadDe(l);
  if (!Number.isFinite(c) || c < 0.001) return 'La cantidad debe ser mayor que cero.';
  if (c > 999_999_999) return 'La cantidad es demasiado grande.';
  if (decimales(c) > 3) return 'La cantidad admite hasta 3 decimales.';
  const d = descuentoDe(l);
  if (!Number.isFinite(d) || d < 0 || d > 100) return 'El descuento debe estar entre 0 y 100.';
  if (decimales(d) > 2) return 'El descuento admite hasta 2 decimales.';
  return null;
}

export function lineasValidas(lineas: readonly LineaEditable[]): boolean {
  return lineas.length <= MAX_LINEAS && lineas.every(l => errorDeLinea(l) === null);
}

export function importesDeLinea(l: LineaEditable): ImportesItem {
  const c = cantidadDe(l);
  const d = descuentoDe(l);
  return importesItem(Number.isFinite(c) ? c : 0, l.precio, Number.isFinite(d) ? d : 0);
}

export function totalesDeLineas(lineas: readonly LineaEditable[]): { subtotal: number; descuento: number; neto: number } {
  return totalesItems(lineas.map(importesDeLinea));
}

/** Agrega una línea de la lista; si el código ya está, suma 1 a su cantidad en vez de duplicarlo. */
export function agregarLinea(lineas: readonly LineaEditable[], item: ItemListaCliente): LineaEditable[] {
  const existe = lineas.some(l => l.listaPreciosItemId === item.listaPreciosItemId);
  if (!existe) return [...lineas, lineaDesdeLista(item)];
  return lineas.map(l => (l.listaPreciosItemId === item.listaPreciosItemId ? { ...l, cantidad: String(Math.round((cantidadDe(l) + 1) * 1000) / 1000) } : l));
}

/** Cuerpo `items` de crear/editar. */
export function lineasAItems(lineas: readonly LineaEditable[]): ItemPedidoRequest[] {
  return lineas.map(l => {
    const item: ItemPedidoRequest = { listaPreciosItemId: l.listaPreciosItemId, cantidad: cantidadDe(l), origen: l.origen };
    const d = descuentoDe(l);
    if (d > 0) item.descuentoPct = d;
    return item;
  });
}
