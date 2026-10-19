import { describe, expect, it } from 'vitest';
import {
  confirmacionesPendientes,
  faltantesDeGabinete,
  pasoDe,
  siguienteAccion,
  type RequisitoGabinete,
} from './permiso-trabajo';

const req = (tipo: RequisitoGabinete['tipo'], ok: boolean): RequisitoGabinete => ({
  tipo,
  nombre: tipo,
  documentoId: ok ? 'd' : null,
  archivoId: ok ? 'a' : null,
  falta: ok ? null : `Falta ${tipo}`,
});

describe('PTW: reglas de pantalla', () => {
  it('el paso sigue a la fase y el aprobado queda en el último', () => {
    expect(pasoDe('gabinete')).toBe(0);
    expect(pasoDe('formalizacion')).toBe(1);
    expect(pasoDe('aprobacion')).toBe(2);
    expect(pasoDe('aprobado')).toBe(2);
  });

  it('dice qué documentos faltan en la gabinete', () => {
    expect(
      faltantesDeGabinete({ requisitos: [req('art', false), req('pt', true), req('sfi', false)] }),
    ).toEqual(['Falta art', 'Falta sfi']);
    expect(faltantesDeGabinete({ requisitos: [req('art', true)] })).toEqual([]);
  });

  it('dice qué confirmaciones de la formalización faltan', () => {
    const f = (tipo: 'ptw_en_sitio' | 'barricadas') => ({
      tipo,
      nombre: 'x',
      firmadoAt: '2026-11-02T10:00:00Z',
    });
    expect(confirmacionesPendientes({ firmas: [] })).toEqual([
      'ptw_en_sitio',
      'acta_recibimiento',
      'barricadas',
    ]);
    expect(confirmacionesPendientes({ firmas: [f('ptw_en_sitio'), f('barricadas')] })).toEqual([
      'acta_recibimiento',
    ]);
  });

  it('la acción siguiente depende de la fase y no existe si está anulado o aprobado', () => {
    expect(siguienteAccion({ fase: 'gabinete', anulado: false })).toBe('validar');
    expect(siguienteAccion({ fase: 'formalizacion', anulado: false })).toBe('confirmar');
    expect(siguienteAccion({ fase: 'aprobacion', anulado: false })).toBe('aprobar');
    expect(siguienteAccion({ fase: 'aprobado', anulado: false })).toBeNull();
    expect(siguienteAccion({ fase: 'gabinete', anulado: true })).toBeNull();
  });
});
