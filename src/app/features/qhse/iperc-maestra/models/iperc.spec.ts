import { describe, expect, it } from 'vitest';
import {
  EJES_VACIOS,
  aContenidoDto,
  esEditable,
  insigniaVigencia,
  nombreDeCodigo,
  pendientesDeGuardado,
  pendientesDeRevision,
  peligroVacio,
  tareaVacia,
  valorar,
  type ActividadResumen,
  type ContenidoBorrador,
} from './iperc';

const aprobada = (
  extra: Partial<NonNullable<ActividadResumen['aprobada']>> = {},
): ActividadResumen['aprobada'] => ({
  matrizId: 'm',
  codigo: 'IPERC-000001',
  version: 2,
  aprobadaEl: '2026-01-01',
  vigenteHasta: '2027-01-01',
  venceEnDias: 200,
  vencida: false,
  porVencer: false,
  ...extra,
});

describe('IPERC: reglas de pantalla', () => {
  it('calcula NP y NR como el servidor y los clasifica con las bandas de la GTC 45', () => {
    expect(valorar({ nd: 2, ne: 3, nc: 25 })).toMatchObject({
      np: 6,
      probabilidad: 'medio',
      nr: 150,
      nivel: 'II',
    });
    expect(valorar({ nd: 6, ne: 4, nc: 100 })).toMatchObject({
      np: 24,
      probabilidad: 'muy_alto',
      nr: 2400,
      nivel: 'I',
      aceptabilidad: 'No aceptable',
    });
    expect(valorar({ nd: 0, ne: 4, nc: 100 })).toMatchObject({
      np: 0,
      nr: 0,
      nivel: 'IV',
      aceptabilidad: 'Aceptable',
    });
    expect(valorar({ nd: 2, ne: null, nc: 25 })).toBeNull();
  });

  it('el contenido solo se edita en borrador o en evaluación', () => {
    expect(esEditable('borrador')).toBe(true);
    expect(esEditable('en_evaluacion')).toBe(true);
    for (const e of ['en_revision', 'aprobada', 'rechazada', 'reemplazada'] as const)
      expect(esEditable(e)).toBe(false);
  });

  it('dice qué falta para guardar y para enviar a revisión', () => {
    const vacio: ContenidoBorrador = { tareas: [tareaVacia()], evaluadorIds: [] };
    expect(pendientesDeGuardado(vacio)).toEqual([
      'describir la tarea 1',
      'describir el peligro 1 de la tarea 1',
      'clasificar el peligro 1 de la tarea 1',
    ]);
    expect(pendientesDeRevision({ tareas: [], evaluadorIds: [] })).toEqual([
      'la matriz no tiene tareas',
    ]);
    expect(pendientesDeRevision(vacio)).toEqual([
      'valorar el riesgo inicial del peligro 1 de la tarea 1',
      'valorar el riesgo residual del peligro 1 de la tarea 1',
    ]);
    const listo: ContenidoBorrador = {
      evaluadorIds: [],
      tareas: [
        {
          ...tareaVacia('c'),
          descripcion: 'T',
          peligros: [
            {
              ...peligroVacio('c'),
              descripcion: 'P',
              inicial: { nd: 2, ne: 3, nc: 25 },
              residual: { nd: 2, ne: 2, nc: 10 },
            },
          ],
        },
      ],
    };
    expect(pendientesDeGuardado(listo)).toEqual([]);
    expect(pendientesDeRevision(listo)).toEqual([]);
  });

  it('el cuerpo que se envía omite los textos vacíos, descarta una valoración a medias y quita controles sin texto', () => {
    const p = {
      ...peligroVacio('c'),
      descripcion: ' Ruido ',
      fuenteRiesgo: '  ',
      inicial: { nd: 2, ne: null, nc: 25 },
      residual: { nd: 2, ne: 2, nc: 10 },
      controles: [
        {
          momento: 'residual' as const,
          tipo: 'epp' as const,
          descripcion: ' Protección auditiva ',
        },
        { momento: 'propuesto' as const, tipo: 'epp' as const, descripcion: '  ' },
      ],
    };
    const dto = aContenidoDto({
      evaluadorIds: ['u'],
      tareas: [{ ...tareaVacia('c'), descripcion: ' Armar ', peligros: [p] }],
    }) as { tareas: { descripcion: string; peligros: Record<string, unknown>[] }[] };
    const pel = dto.tareas[0].peligros[0];
    expect(dto.tareas[0].descripcion).toBe('Armar');
    expect(pel['descripcion']).toBe('Ruido');
    expect(pel['fuenteRiesgo']).toBeUndefined();
    expect(pel['inicial']).toBeUndefined();
    expect(pel['residual']).toEqual({ nd: 2, ne: 2, nc: 10 });
    expect(pel['controles']).toEqual([
      { momento: 'residual', tipo: 'epp', descripcion: 'Protección auditiva' },
    ]);
    expect(EJES_VACIOS).toEqual({ nd: null, ne: null, nc: null });
  });

  it('la insignia de vigencia distingue sin matriz, vencida, por vencer y vigente', () => {
    expect(insigniaVigencia({ aprobada: null })).toEqual({
      text: 'Sin matriz aprobada',
      tone: 'warning',
    });
    expect(insigniaVigencia({ aprobada: aprobada({ vencida: true, venceEnDias: -3 }) })).toEqual({
      text: 'Vencida',
      tone: 'error',
    });
    expect(insigniaVigencia({ aprobada: aprobada({ porVencer: true, venceEnDias: 12 }) })).toEqual({
      text: 'Vence en 12 días',
      tone: 'warning',
    });
    expect(insigniaVigencia({ aprobada: aprobada({ porVencer: true, venceEnDias: 1 }) }).text).toBe(
      'Vence en 1 día',
    );
    expect(insigniaVigencia({ aprobada: aprobada() })).toEqual({
      text: 'Vigente (v2)',
      tone: 'success',
    });
  });

  it('pone nombre legible a un código de tipo de servicio', () => {
    expect(nombreDeCodigo('wellbore_cleanup_tools')).toBe('Wellbore Cleanup Tools');
    expect(nombreDeCodigo('slickline')).toBe('Slickline');
  });
});
