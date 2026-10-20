import { describe, expect, it } from 'vitest';
import {
  previsualizarRiesgo,
  tareasDeViaje,
  type PreguntaRiesgo,
  type UmbralRiesgo,
  type ViajeContextoPumping,
  type ViajeResumen,
} from './viaje-flota.model';

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

describe('tareasDeViaje', () => {
  const ticket = (extra: Partial<ViajeContextoPumping> = {}): ViajeContextoPumping => ({
    ticketId: 't1',
    ticketNumero: 4549,
    pedidoCodigo: 'PEC-1',
    cliente: null,
    destino: { campo: null, pozo: null },
    serviciosPrincipales: [],
    supervisor: null,
    paso: { codigo: 'traslado_salida', nombre: 'Traslado de salida' },
    unidades: [{ vehiculoId: 'v1', placa: 'GSI6538' }],
    tiposViaje: ['salida'],
    ...extra,
  });
  const viaje = (extra: Partial<ViajeResumen>): ViajeResumen => ({
    id: 'g1',
    codigo: 'GV-1',
    tipo: 'salida',
    ticketId: 't1',
    fecha: '2026-10-20',
    conductor: { id: 'c1', nombre: 'C' },
    unidad: { id: 'u1', codigo: 'U', vehiculoId: 'v1' },
    puntajeTotal: 0,
    nivel: 'bajo',
    estado: 'pendiente',
    puedeDecidir: false,
    createdAt: '2026-10-20T10:00:00Z',
    ...extra,
  });

  it('al asignar al conductor le toca el de salida de su unidad, por completar', () => {
    const t = tareasDeViaje([ticket()], []);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ tipo: 'salida', estado: 'por_completar', viajeId: null });
  });

  it('desde la ejecución le toca también el de retorno', () => {
    const t = tareasDeViaje([ticket({ tiposViaje: ['salida', 'retorno'] })], []);
    expect(t.map((x) => x.tipo)).toEqual(['salida', 'retorno']);
  });

  it('enviada queda pendiente de aprobación y autorizada, aprobada', () => {
    expect(tareasDeViaje([ticket()], [viaje({})])[0]).toMatchObject({
      estado: 'pendiente',
      viajeId: 'g1',
    });
    expect(tareasDeViaje([ticket()], [viaje({ estado: 'autorizado' })])[0].estado).toBe('aprobado');
  });

  it('un rechazo reabre la tarea; cada unidad tiene la suya', () => {
    const rechazada = tareasDeViaje([ticket()], [viaje({ estado: 'rechazado' })])[0];
    expect(rechazada).toMatchObject({ estado: 'por_completar', rechazado: true, viajeId: null });
    const dos = ticket({
      unidades: [
        { vehiculoId: 'v1', placa: 'A' },
        { vehiculoId: 'v2', placa: 'B' },
      ],
    });
    const t = tareasDeViaje([dos], [viaje({ estado: 'autorizado' })]);
    expect(t.map((x) => [x.unidad.placa, x.estado])).toEqual([
      ['A', 'aprobado'],
      ['B', 'por_completar'],
    ]);
  });
});
