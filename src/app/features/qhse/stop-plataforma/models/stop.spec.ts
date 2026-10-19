import { describe, expect, it } from 'vitest';
import {
  accionesDisponibles,
  conteoMarcas,
  itemsDeMarcas,
  marcar,
  pendientesDeRegistro,
  porcentajesDePareto,
} from './stop';

describe('STOP: reglas de pantalla', () => {
  it('tocar de nuevo la misma marca la quita y cambiar de estado la reemplaza', () => {
    let m = marcar(new Map(), 'a', 'inseguro');
    expect([...m.entries()]).toEqual([['a', 'inseguro']]);
    m = marcar(m, 'a', 'seguro');
    expect(m.get('a')).toBe('seguro');
    m = marcar(m, 'a', 'seguro');
    expect(m.size).toBe(0);
  });

  it('no modifica el mapa original (devuelve uno nuevo)', () => {
    const base = new Map<string, 'seguro' | 'inseguro'>([['a', 'seguro']]);
    const nuevo = marcar(base, 'b', 'inseguro');
    expect(base.size).toBe(1);
    expect(nuevo.size).toBe(2);
  });

  it('cuenta seguros e inseguros y arma los ítems que se envían', () => {
    const m = marcar(marcar(marcar(new Map(), 'a', 'seguro'), 'b', 'inseguro'), 'c', 'inseguro');
    expect(conteoMarcas(m)).toEqual({ seguros: 1, inseguros: 2 });
    expect(itemsDeMarcas(m)).toEqual([
      { itemId: 'a', estado: 'seguro' },
      { itemId: 'b', estado: 'inseguro' },
      { itemId: 'c', estado: 'inseguro' },
    ]);
  });

  it('exige al menos un ítem marcado', () => {
    expect(pendientesDeRegistro(new Map())).toEqual([
      'marcar al menos un ítem como seguro o inseguro',
    ]);
    expect(pendientesDeRegistro(marcar(new Map(), 'a', 'seguro'))).toEqual([]);
  });

  it('una abierta se deriva o se resuelve, una derivada se cierra y el resto no tiene acciones', () => {
    expect(accionesDisponibles('abierto')).toEqual([
      'derivar_mantenimiento',
      'derivar_otro',
      'resolver',
    ]);
    expect(accionesDisponibles('derivado_mantenimiento')).toEqual(['cerrar']);
    expect(accionesDisponibles('derivado_otro')).toEqual(['cerrar']);
    expect(accionesDisponibles('resuelto_qhse')).toEqual([]);
    expect(accionesDisponibles('cerrado')).toEqual([]);
  });

  it('el Pareto mide cada barra contra la mayor', () => {
    expect(porcentajesDePareto([{ inseguros: 8 }, { inseguros: 4 }, { inseguros: 1 }])).toEqual([
      100, 50, 13,
    ]);
    expect(porcentajesDePareto([])).toEqual([]);
    expect(porcentajesDePareto([{ inseguros: 0 }])).toEqual([0]);
  });
});
