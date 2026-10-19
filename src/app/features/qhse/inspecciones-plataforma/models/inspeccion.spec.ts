import { describe, expect, it } from 'vitest';
import {
  criteriosQueFallan,
  evaluar,
  pendientesDeInspeccion,
  resultadoDe,
  textoProxima,
  type TipoInspeccion,
} from './inspeccion';

const tipo = (extra: Partial<TipoInspeccion> = {}): TipoInspeccion => ({
  id: 't',
  codigo: 'eslinga_cable',
  nombre: 'Eslinga de cable',
  frecuenciaDias: 90,
  requiereBumpTest: false,
  requiereUnidad: false,
  generaCasoMantenimiento: false,
  criterios: [
    { id: 'a', nombre: 'Sin hilos rotos' },
    { id: 'b', nombre: 'Ganchos con seguro' },
  ],
  ...extra,
});

describe('inspecciones: reglas de pantalla', () => {
  it('el resultado depende de todos los criterios: rechazada si alguno falla y sin resultado mientras falte evaluar', () => {
    const t = tipo();
    expect(resultadoDe(t, new Map())).toBeNull();
    expect(resultadoDe(t, evaluar(new Map(), 'a', true))).toBeNull();
    expect(resultadoDe(t, evaluar(evaluar(new Map(), 'a', true), 'b', true))).toBe('aprobado');
    expect(resultadoDe(t, evaluar(evaluar(new Map(), 'a', true), 'b', false))).toBe('rechazado');
  });

  it('dice qué criterios fallan', () => {
    const e = evaluar(evaluar(new Map(), 'a', false), 'b', true);
    expect(criteriosQueFallan(tipo(), e)).toEqual(['Sin hilos rotos']);
  });

  it('cambiar una respuesta no modifica el mapa original', () => {
    const base = evaluar(new Map(), 'a', true);
    const nuevo = evaluar(base, 'a', false);
    expect(base.get('a')).toBe(true);
    expect(nuevo.get('a')).toBe(false);
  });

  it('dice qué falta para registrar según el tipo (equipo, unidad, bump test y criterios)', () => {
    const e = evaluar(new Map(), 'a', true);
    expect(
      pendientesDeInspeccion(null, { equipoCodigo: '', unidadId: '', bumpTest: null }, e),
    ).toEqual(['elegir el tipo de equipo']);
    expect(
      pendientesDeInspeccion(tipo(), { equipoCodigo: ' ', unidadId: '', bumpTest: null }, e),
    ).toEqual(['indicar el número o código del equipo', 'evaluar 1 criterio(s)']);
    expect(
      pendientesDeInspeccion(
        tipo({ requiereUnidad: true }),
        { equipoCodigo: 'x', unidadId: '', bumpTest: null },
        e,
      ),
    ).toEqual(['elegir la unidad', 'evaluar 1 criterio(s)']);
    expect(
      pendientesDeInspeccion(
        tipo({ requiereBumpTest: true }),
        { equipoCodigo: 'DET-1', unidadId: '', bumpTest: null },
        evaluar(e, 'b', true),
      ),
    ).toEqual(['indicar si se hizo el bump test']);
    expect(
      pendientesDeInspeccion(
        tipo(),
        { equipoCodigo: 'ESL-1', unidadId: '', bumpTest: null },
        evaluar(e, 'b', true),
      ),
    ).toEqual([]);
  });

  it('el texto de la próxima inspección distingue hoy, futuro y atraso', () => {
    expect(textoProxima(0)).toBe('Hoy');
    expect(textoProxima(1)).toBe('En 1 día');
    expect(textoProxima(90)).toBe('En 90 días');
    expect(textoProxima(-1)).toBe('Atrasada 1 día');
    expect(textoProxima(-5)).toBe('Atrasada 5 días');
  });
});
