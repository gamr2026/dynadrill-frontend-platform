import type { ItemEstimado } from '../../../facturacion/models/pedido.model';
import type { FcrTool } from './fcr.model';
import { agruparActividadesDelPedido, notaPrecarga } from './fcr-actividades-pedido';

function item(codigo: string, extra: Partial<ItemEstimado> = {}): ItemEstimado {
  return {
    codigo,
    descripcion: `Línea ${codigo}`,
    unidad: 'UN',
    cantidad: 1,
    valorUnitario: 1,
    ...extra,
  };
}

function tool(id: number, codigoPedido?: string): FcrTool {
  return { id, name: `Herramienta ${id}`, status: 'seleccionada', codigoPedido };
}

describe('agruparActividadesDelPedido', () => {
  const items = [
    item('SH1101', { unidad: 'Corrida', cantidad: 2 }),
    item('SFS6146', { unidad: 'km', cantidad: 76.8, esMovilizacion: true }),
    item('PER-01'),
  ];

  it('separa herramientas (con cuántas se precargaron), movilización y otros servicios', () => {
    const r = agruparActividadesDelPedido(
      items,
      [tool(1, 'SH1101'), tool(2, 'SH1101'), tool(3, 'SH1101')],
      undefined,
      [],
    );
    expect(r.herramientas).toEqual([{ item: items[0], cantidadHerramientas: 3, aviso: null }]);
    expect(r.movilizaciones).toEqual([
      { codigo: 'SFS6146', descripcion: 'Línea SFS6146', cantidad: 76.8, unidad: 'km' },
    ]);
    expect(r.otros).toEqual([{ item: items[2], aviso: null }]);
  });

  it('usa la movilización que guardó el ticket cuando la tiene', () => {
    const snapshot = [{ codigo: 'SFS6147', descripcion: 'Pesadas', cantidad: 10, unidad: 'km' }];
    expect(agruparActividadesDelPedido(items, [], snapshot, []).movilizaciones).toEqual(snapshot);
  });

  it('cada línea lleva su aviso una sola vez, en vez de repetirse en una lista aparte', () => {
    const r = agruparActividadesDelPedido(items, [tool(1, 'SH1101')], undefined, [
      { motivo: 'articulo_inactivo', codigo: 'SH1101', descripcion: 'Línea SH1101' },
      { motivo: 'sin_configurar', codigo: 'PER-01', descripcion: 'Línea PER-01' },
    ]);
    expect(r.herramientas[0].aviso).toBe('articulo_inactivo');
    expect(r.otros).toEqual([{ item: items[2], aviso: 'sin_configurar' }]);
  });

  it('las herramientas agregadas a mano (sin codigoPedido) no se cuentan en ninguna línea', () => {
    const r = agruparActividadesDelPedido(items, [tool(1)], undefined, []);
    expect(r.herramientas).toEqual([]);
    expect(r.otros.map((o) => o.item.codigo)).toEqual(['SH1101', 'PER-01']);
  });
});

describe('notaPrecarga', () => {
  it('sin avisos no hay nota', () => {
    expect(notaPrecarga([])).toBeNull();
  });

  it('una sola nota para todas las líneas marcadas', () => {
    expect(
      notaPrecarga([
        { motivo: 'sin_configurar', codigo: 'A' },
        { motivo: 'kit_vacio', codigo: 'B' },
      ]),
    ).toBe(
      '2 línea(s) del Pedido no trajeron todas sus herramientas. Si llevan, agréguelas a mano o configure su código en "Códigos por cliente" y recargue.',
    );
  });

  it('el Pedido sin cliente tiene su propio mensaje', () => {
    expect(notaPrecarga([{ motivo: 'pedido_sin_cliente' }])).toBe(
      'El Pedido no tiene un cliente del catálogo: no se pudieron precargar herramientas. Agréguelas a mano.',
    );
  });
});
