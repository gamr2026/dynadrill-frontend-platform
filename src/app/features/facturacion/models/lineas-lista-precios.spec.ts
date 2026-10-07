import type { ListaPrecios, ListaPreciosItem } from './lista-precios.model';
import { esItemDeMovilizacion, itemsDeMovilizacion, itemsDeServicio, listaParaLineas, precioFijoDeMovilizacion } from './lineas-lista-precios';

function item(codigo: string, descripcion: string, precio = 1): ListaPreciosItem {
  return { id: 0, codigo, descripcion, unidad: 'Unidad', precio, tipo: 'Servicio' };
}

function lista(id: number, clienteId: number | undefined, items: ListaPreciosItem[]): ListaPrecios {
  return { id, cliente: `Lista ${id}`, clienteId, numeroContrato: 'C', vigenteDesde: '2026-01-01', activa: true, items };
}

const CLIENTE = lista(1, 5, [item('SFS6146', 'Movilizacion unidades livianas', 2.66), item('SH1101', 'Sarta de limpieza 7"')]);
const NORMAL = lista(2, undefined, [item('SFS6146', 'Movilización unidades livianas', 0.01), item('SFS6147', 'MOVILIZACION pesadas', 0.01)]);

describe('listaParaLineas', () => {
  it('usa la lista del cliente si tiene', () => {
    expect(listaParaLineas(CLIENTE, NORMAL)).toEqual({ items: CLIENTE.items, origen: 'cliente' });
  });

  it('si el cliente no tiene lista, usa la Normal (referencia interna)', () => {
    expect(listaParaLineas(null, NORMAL)).toEqual({ items: NORMAL.items, origen: 'referencia' });
  });

  it('sin ninguna de las dos no hay de dónde sacar códigos', () => {
    expect(listaParaLineas(null, null)).toBeNull();
  });
});

describe('movilización y servicio', () => {
  it('reconoce la movilización por la descripción, con o sin tilde y en cualquier caja', () => {
    expect(esItemDeMovilizacion(NORMAL.items[0])).toBe(true);
    expect(esItemDeMovilizacion(NORMAL.items[1])).toBe(true);
    expect(esItemDeMovilizacion(CLIENTE.items[1])).toBe(false);
  });

  it('separa los ítems de movilización de los de servicio, sin solaparse', () => {
    const l = listaParaLineas(CLIENTE, NORMAL);
    expect(itemsDeMovilizacion(l).map(i => i.codigo)).toEqual(['SFS6146']);
    expect(itemsDeServicio(l).map(i => i.codigo)).toEqual(['SH1101']);
    expect(itemsDeMovilizacion(null)).toEqual([]);
  });
});

describe('precioFijoDeMovilizacion', () => {
  it('fijo si el código está en la lista del cliente (precio pactado)', () => {
    expect(precioFijoDeMovilizacion('SFS6146', CLIENTE)).toBe(true);
  });

  it('editable si sale de la Normal o el cliente no lo tiene', () => {
    expect(precioFijoDeMovilizacion('SFS6146', null)).toBe(false);
    expect(precioFijoDeMovilizacion('SFS6147', CLIENTE)).toBe(false);
    expect(precioFijoDeMovilizacion('', CLIENTE)).toBe(false);
  });
});
