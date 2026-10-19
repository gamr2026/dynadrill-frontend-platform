import { describe, expect, it } from 'vitest';
import { previsualizarRiesgo, type PreguntaRiesgo, type UmbralRiesgo } from './viaje-flota.model';

const umbrales: UmbralRiesgo[] = [
  { nivel: 'bajo', desdePuntos: 0, permisoAutoriza: 'a', descripcion: '' },
  { nivel: 'medio', desdePuntos: 31, permisoAutoriza: 'b', descripcion: '' },
  { nivel: 'alto', desdePuntos: 76, permisoAutoriza: 'b', descripcion: '' },
];
const preguntas: PreguntaRiesgo[] = [
  {
    id: 'p1',
    codigo: 'a',
    orden: 1,
    texto: 'A',
    opciones: [
      { id: 'o1', etiqueta: 'Sí', puntos: 0, impideConducir: false },
      { id: 'o2', etiqueta: 'No: deténgase', puntos: 0, impideConducir: true },
    ],
  },
  {
    id: 'p2',
    codigo: 'b',
    orden: 2,
    texto: 'B',
    opciones: [
      { id: 'o3', etiqueta: '15', puntos: 15, impideConducir: false },
      { id: 'o4', etiqueta: '40', puntos: 40, impideConducir: false },
    ],
  },
];

describe('previsualizarRiesgo', () => {
  it('suma los puntos y calcula el nivel por umbrales', () => {
    expect(previsualizarRiesgo(preguntas, { p1: 'o1', p2: 'o3' }, umbrales)).toMatchObject({
      puntos: 15,
      nivel: 'bajo',
      sinContestar: 0,
      impide: null,
    });
    expect(previsualizarRiesgo(preguntas, { p1: 'o1', p2: 'o4' }, umbrales)).toMatchObject({
      puntos: 40,
      nivel: 'medio',
    });
  });

  it('avisa lo que falta contestar y la respuesta que impide viajar', () => {
    expect(previsualizarRiesgo(preguntas, { p1: 'o2' }, umbrales)).toMatchObject({
      sinContestar: 1,
      impide: 'No: deténgase',
    });
  });
});
