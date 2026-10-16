import {
  agregarLinea,
  errorDeLinea,
  importesDeLinea,
  lineaDesdeItemPedido,
  lineaDesdeLista,
  lineaDesdePlantilla,
  lineasAItems,
  lineasValidas,
  totalesDeLineas,
  type LineaEditable,
} from './lineas-pedido';
import type { ItemListaCliente, ItemPedido, ItemPlantillaValidado } from './pedido-comercial.model';

const item = (n: number): ItemListaCliente => ({
  listaPreciosItemId: `li-${n}`,
  listaPreciosId: 'l1',
  numeroContrato: 'CT-1',
  codigo: `COD-${n}`,
  descripcion: `Ítem ${n}`,
  unidad: 'UN',
  precio: 10 * n,
  tipo: 'Servicio',
});

const con = (l: LineaEditable, cambios: Partial<LineaEditable>): LineaEditable => ({ ...l, ...cambios });

describe('líneas del pedido', () => {
  it('agrega desde la lista con cantidad 1 y precio de la lista', () => {
    const l = lineaDesdeLista(item(2));
    expect(l).toMatchObject({ listaPreciosItemId: 'li-2', cantidad: '1', descuentoPct: '0', precio: 20, origen: 'lista' });
  });

  it('un ítem repetido suma 1 en vez de duplicarse', () => {
    const una = agregarLinea([], item(1));
    const dos = agregarLinea(una, item(1));
    expect(dos).toHaveLength(1);
    expect(dos[0].cantidad).toBe('2');
    expect(agregarLinea(dos, item(2))).toHaveLength(2);
  });

  it('valida cantidad y descuento con las reglas del DTO', () => {
    const base = lineaDesdeLista(item(1));
    expect(errorDeLinea(base)).toBeNull();
    expect(errorDeLinea(con(base, { cantidad: '0' }))).toMatch(/mayor que cero/);
    expect(errorDeLinea(con(base, { cantidad: 'abc' }))).toMatch(/mayor que cero/);
    expect(errorDeLinea(con(base, { cantidad: '1.2345' }))).toMatch(/3 decimales/);
    expect(errorDeLinea(con(base, { cantidad: '2,5' }))).toBeNull();
    expect(errorDeLinea(con(base, { descuentoPct: '101' }))).toMatch(/entre 0 y 100/);
    expect(errorDeLinea(con(base, { descuentoPct: '-1' }))).toMatch(/entre 0 y 100/);
    expect(errorDeLinea(con(base, { descuentoPct: '10.123' }))).toMatch(/2 decimales/);
    expect(errorDeLinea(con(base, { descuentoPct: '' }))).toBeNull();
  });

  it('lineasValidas exige que todas sean válidas', () => {
    const ok = lineaDesdeLista(item(1));
    expect(lineasValidas([ok])).toBe(true);
    expect(lineasValidas([ok, con(ok, { cantidad: '0' })])).toBe(false);
  });

  it('calcula importes y totales', () => {
    const l = con(lineaDesdeLista(item(1)), { cantidad: '3', descuentoPct: '10' });
    expect(importesDeLinea(l)).toEqual({ bruto: 30, descuento: 3, neto: 27 });
    const t = totalesDeLineas([l, lineaDesdeLista(item(2))]);
    expect(t).toEqual({ subtotal: 50, descuento: 3, neto: 47 });
  });

  it('arma el cuerpo items: descuento solo si aplica', () => {
    const a = con(lineaDesdeLista(item(1)), { cantidad: '2,5', descuentoPct: '5' });
    const b = lineaDesdeLista(item(2));
    expect(lineasAItems([a, b])).toEqual([
      { listaPreciosItemId: 'li-1', cantidad: 2.5, origen: 'lista', descuentoPct: 5 },
      { listaPreciosItemId: 'li-2', cantidad: 1, origen: 'lista' },
    ]);
  });

  it('la plantilla valida usa el precio de la lista y marca el origen', () => {
    const v: ItemPlantillaValidado = {
      fila: 1,
      listaPreciosItemId: 'li-9',
      codigo: 'COD-9',
      descripcion: 'Nueve',
      unidad: null,
      cantidad: 4,
      precioLista: 90,
      descuentoPct: 5,
      diferenciaPrecio: -2,
      origen: 'plantilla',
    };
    expect(lineaDesdePlantilla(v)).toMatchObject({ precio: 90, cantidad: '4', descuentoPct: '5', origen: 'plantilla' });
  });

  it('un ítem guardado sin vínculo con la lista no se puede reenviar', () => {
    const guardado: ItemPedido = {
      id: 'i1',
      orden: 1,
      codigo: 'X',
      descripcion: 'X',
      unidad: null,
      cantidad: 1,
      valorUnitario: 5,
      descuentoPct: null,
      origenItem: 'lista',
      listaPreciosItemId: null,
      bruto: 5,
      descuento: 0,
      neto: 5,
    };
    expect(lineaDesdeItemPedido(guardado)).toBeNull();
    expect(lineaDesdeItemPedido({ ...guardado, listaPreciosItemId: 'li-1' })).toMatchObject({ precio: 5, origen: 'lista' });
  });
});
