import { describe, expect, it } from 'vitest';
import {
  bloqueaElTicket,
  criteriosPendientes,
  rolesSinNotificar,
  siguientePaso,
  type SwaDetalle,
} from './swa';

const cadena = (...notificados: boolean[]): SwaDetalle['cadena'] =>
  notificados.map((n, i) => ({
    rolCadenaId: `r${i}`,
    rolCodigo: `c${i}`,
    rol: `Rol ${i}`,
    notificadoAt: n ? '2026-11-02T10:00:00Z' : null,
    notificadoPor: n ? 'x' : null,
  }));

describe('SWA: reglas de pantalla', () => {
  it('dice a qué roles falta notificar', () => {
    expect(rolesSinNotificar({ cadena: cadena(true, false, false) })).toEqual(['Rol 1', 'Rol 2']);
    expect(rolesSinNotificar({ cadena: cadena(true, true) })).toEqual([]);
  });

  it('dice qué criterios de reinicio faltan', () => {
    const c = (nombre: string, ok: boolean) => ({
      criterioId: nombre,
      nombre,
      confirmadoAt: ok ? '2026-11-02T10:00:00Z' : null,
      confirmadoPor: ok ? 'x' : null,
    });
    expect(criteriosPendientes({ criterios: [c('a', true), c('b', false)] })).toEqual(['b']);
  });

  it('la evaluación se habilita solo con toda la cadena notificada', () => {
    expect(siguientePaso({ estado: 'activo', notificacionCompleta: false })).toBe('notificar');
    expect(siguientePaso({ estado: 'activo', notificacionCompleta: true })).toBe('evaluar');
    expect(siguientePaso({ estado: 'evaluado', notificacionCompleta: true })).toBe('reiniciar');
    expect(siguientePaso({ estado: 'cerrado', notificacionCompleta: true })).toBeNull();
  });

  it('bloquea el ticket mientras no esté cerrada y solo si es de un servicio', () => {
    expect(bloqueaElTicket({ estado: 'activo', ticketId: 't' })).toBe(true);
    expect(bloqueaElTicket({ estado: 'evaluado', ticketId: 't' })).toBe(true);
    expect(bloqueaElTicket({ estado: 'cerrado', ticketId: 't' })).toBe(false);
    expect(bloqueaElTicket({ estado: 'activo', ticketId: null })).toBe(false);
  });
});
