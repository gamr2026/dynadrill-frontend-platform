import { describe, expect, it } from 'vitest';
import { accionEnBlanco, accionesConContenido, estadoVisible } from './objetivo-ambiental.model';

describe('Objetivos ambientales: reglas de pantalla', () => {
  it('mientras está en curso se muestra el estado del plazo; si no tiene plazo, «sin plazo»', () => {
    expect(estadoVisible({ estado: 'en_curso', estadoPlazo: 'por_vencer' })).toBe('por_vencer');
    expect(estadoVisible({ estado: 'en_curso', estadoPlazo: 'vencido' })).toBe('vencido');
    expect(estadoVisible({ estado: 'en_curso', estadoPlazo: null })).toBe('sin_plazo');
  });

  it('un objetivo cerrado muestra su resultado y no el plazo', () => {
    expect(estadoVisible({ estado: 'cumplido', estadoPlazo: null })).toBe('cumplido');
    expect(estadoVisible({ estado: 'no_cumplido', estadoPlazo: 'vencido' })).toBe('no_cumplido');
  });

  it('del plan de acción solo se envían las acciones con descripción, sin campos vacíos', () => {
    const filas = [
      { ...accionEnBlanco() },
      {
        accionEspecifica: '  Instalar medidores  ',
        responsableId: 'u1',
        indicador: ' ',
        evidenciaEsperada: 'Actas',
        frecuenciaId: '',
      },
    ];
    expect(accionesConContenido(filas)).toEqual([
      { accionEspecifica: 'Instalar medidores', responsableId: 'u1', evidenciaEsperada: 'Actas' },
    ]);
  });

  it('un plan en blanco no manda acciones', () => {
    expect(accionesConContenido([accionEnBlanco()])).toEqual([]);
  });
});
