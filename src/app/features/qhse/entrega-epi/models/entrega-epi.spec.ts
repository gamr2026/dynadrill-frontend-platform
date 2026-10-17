import { describe, expect, it } from 'vitest';
import { esEditable, mensajeErrorEpi, pendientesDeDespacho, sinCapacitacion, type EntregaEpi } from './entrega-epi';

const firma = { usuarioId: 'u', nombre: 'Oscar', at: '2026-11-02T10:00:00Z' };
const renglon = (recibioCapacitacion: boolean) =>
  ({ id: 'r', elementoId: 'e', elemento: 'Casco de seguridad', cantidad: 1, tallaId: null, talla: null, recibioCapacitacion, observaciones: null, entregadoEl: '2026-11-02' }) satisfies EntregaEpi['renglones'][number];

describe('entrega de EPI: reglas de pantalla', () => {
  it('los renglones se editan hasta despachar', () => {
    expect(esEditable({ estado: 'solicitado' })).toBe(true);
    expect(esEditable({ estado: 'aprobado' })).toBe(true);
    expect(esEditable({ estado: 'despachado' })).toBe(false);
    expect(esEditable({ estado: 'rechazado' })).toBe(false);
  });

  it('dice qué falta para despachar solo cuando está aprobada', () => {
    expect(pendientesDeDespacho({ estado: 'solicitado', lugar: null, renglones: [], firmaTrabajador: null })).toEqual([]);
    expect(pendientesDeDespacho({ estado: 'aprobado', lugar: null, renglones: [], firmaTrabajador: null })).toEqual([
      'indicar el lugar de la entrega',
      'registrar al menos un elemento entregado',
      'registrar la declaración del trabajador',
    ]);
    expect(pendientesDeDespacho({ estado: 'aprobado', lugar: { id: 'b', nombre: 'Base Lago Agrio' }, renglones: [renglon(true)], firmaTrabajador: firma })).toEqual([]);
  });

  it('detecta los elementos entregados sin capacitación', () => {
    expect(sinCapacitacion({ renglones: [renglon(true), renglon(false)] })).toHaveLength(1);
  });

  it('usa el texto del servidor y, si no hay, uno por defecto según el caso', () => {
    expect(mensajeErrorEpi({ status: 400, error: { detail: 'Indique el motivo del rechazo' } }, 'x')).toBe('Indique el motivo del rechazo');
    expect(mensajeErrorEpi({ status: 400, error: { message: ['a', 'b'] } }, 'x')).toBe('a. b');
    expect(mensajeErrorEpi({ status: 403 }, 'x')).toMatch(/permiso/);
    expect(mensajeErrorEpi({ status: 409 }, 'x')).toMatch(/cambió/);
    expect(mensajeErrorEpi(null, 'No se pudo')).toBe('No se pudo');
  });
});
