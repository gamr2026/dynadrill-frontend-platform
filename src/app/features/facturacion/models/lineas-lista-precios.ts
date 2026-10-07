import type { ListaPrecios, ListaPreciosItem } from './lista-precios.model';

/**
 * De dónde salen el código, la descripción, la unidad y el precio de una
 * línea del Pedido elegida de una Lista de Precios (specs/fcr-precarga-herramientas):
 * la lista del cliente; si el cliente no tiene, la "Normal" (referencia
 * interna, sin cliente, sus precios son de relleno). Nada se inventa.
 */
export type OrigenListaPrecios = 'cliente' | 'referencia';

export interface ListaParaLineas {
  items: ListaPreciosItem[];
  origen: OrigenListaPrecios;
}

export function listaParaLineas(listaCliente: ListaPrecios | null, listaReferencia: ListaPrecios | null): ListaParaLineas | null {
  if (listaCliente) return { items: listaCliente.items, origen: 'cliente' };
  if (listaReferencia) return { items: listaReferencia.items, origen: 'referencia' };
  return null;
}

/** Los códigos de movilización no tienen un tipo propio en la Lista de Precios: se reconocen por la descripción. */
export function esItemDeMovilizacion(item: Pick<ListaPreciosItem, 'descripcion'>): boolean {
  return /moviliz/i.test(item.descripcion);
}

export function itemsDeMovilizacion(lista: ListaParaLineas | null): ListaPreciosItem[] {
  return (lista?.items ?? []).filter(esItemDeMovilizacion);
}

/** Todo lo que no es movilización: la movilización solo se carga con su propio tipo de línea. */
export function itemsDeServicio(lista: ListaParaLineas | null): ListaPreciosItem[] {
  return (lista?.items ?? []).filter(i => !esItemDeMovilizacion(i));
}

/** El precio de una movilización queda fijo solo si es el pactado con el cliente (está en su lista). */
export function precioFijoDeMovilizacion(codigo: string, listaCliente: ListaPrecios | null): boolean {
  const c = codigo.trim();
  return !!c && !!listaCliente?.items.some(i => i.codigo === c);
}
