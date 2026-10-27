import { describe, expect, it } from 'vitest';
import { compararItems, etiquetaAplicacion, validarCambio, type ItemCambio, type ItemsParaCambio } from './cambio-items';

const item = (id: string, extra: Partial<ItemCambio> = {}): ItemCambio => ({
  listaPreciosItemId: id,
  codigo: `COD-${id}`,
  descripcion: `Ítem ${id}`,
  unidad: 'día',
  unidadMedidaId: 'um-dia',
  cantidad: 2,
  descuentoPct: null,
  tipoLinea: 'servicio',
  ...extra,
});

describe('compararItems', () => {
  const hoy: ItemsParaCambio['actuales'] = [item('a'), item('b', { cantidad: 10, descuentoPct: 5 }), { ...item('c'), listaPreciosItemId: null }];

  it('detecta ítems nuevos, quitados, cantidades y descuentos distintos', () => {
    const cambios = compararItems(hoy, [item('a', { cantidad: 3 }), item('b', { cantidad: 10, descuentoPct: 8 }), item('d')]);
    expect(cambios.map(c => c.tipo).sort()).toEqual(['cantidad', 'descuento', 'nuevo']);
    expect(cambios.find(c => c.tipo === 'cantidad')).toMatchObject({ antes: 2, item: { listaPreciosItemId: 'a' } });
    expect(cambios.find(c => c.tipo === 'descuento')).toMatchObject({ antes: 5 });
    expect(cambios.find(c => c.tipo === 'nuevo')?.item.listaPreciosItemId).toBe('d');
  });

  it('lo que sale de la lista propuesta cuenta como quitado, pero los ítems sin enlace a la lista no se comparan', () => {
    const cambios = compararItems(hoy, [item('a')]);
    expect(cambios).toEqual([expect.objectContaining({ tipo: 'quitado', item: expect.objectContaining({ listaPreciosItemId: 'b' }) })]);
  });

  it('sin diferencias no hay cambios', () => {
    expect(compararItems(hoy, [item('a'), item('b', { cantidad: 10, descuentoPct: 5 })])).toEqual([]);
  });
});

describe('validarCambio', () => {
  const bien = [{ cantidad: 1, descuentoPct: null }];

  it('pide ítems, cantidades válidas, algún cambio y el motivo', () => {
    expect(validarCambio('Se usó más', bien, true)).toBeNull();
    expect(validarCambio('Se usó más', [], true)).toContain('al menos un ítem');
    expect(validarCambio('Se usó más', [{ cantidad: 0, descuentoPct: null }], true)).toContain('cantidad');
    expect(validarCambio('Se usó más', [{ cantidad: 1, descuentoPct: 120 }], true)).toContain('descuento');
    expect(validarCambio('Se usó más', bien, false)).toContain('No hay cambios');
    expect(validarCambio('  ', bien, true)).toContain('motivo');
  });
});

describe('etiquetaAplicacion', () => {
  it('dice qué pasó con el cambio solo cuando se aprobó', () => {
    expect(etiquetaAplicacion({ estado: 'pendiente', aplicacion: null, aplicacionMotivo: null })).toBeNull();
    expect(etiquetaAplicacion({ estado: 'rechazada', aplicacion: null, aplicacionMotivo: null })).toBeNull();
    expect(etiquetaAplicacion({ estado: 'aprobada', aplicacion: 'pendiente', aplicacionMotivo: null })).toContain('Esperando');
    expect(etiquetaAplicacion({ estado: 'aprobada', aplicacion: 'aplicada', aplicacionMotivo: null })).toBe('Aplicado en el pedido');
    expect(etiquetaAplicacion({ estado: 'aprobada', aplicacion: 'no_aplicada', aplicacionMotivo: 'El pedido ya salió al cliente' })).toContain('El pedido ya salió al cliente');
  });
});
