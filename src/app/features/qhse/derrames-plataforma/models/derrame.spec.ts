import { describe, expect, it } from 'vitest';
import {
  formatoBarriles,
  leerBarriles,
  pasosPendientes,
  puedeConfirmarVolumen,
  puedeContener,
  rangoDeBanda,
  textoPlazoContencion,
  type DerrameDetalle,
} from './derrame';

const paso = (nombre: string, ok: boolean): DerrameDetalle['checklist'][number] => ({
  itemId: nombre,
  codigo: nombre,
  nombre,
  confirmadoAt: ok ? '2026-10-24T10:00:00Z' : null,
  confirmadoPor: ok ? 'x' : null,
});

describe('Derrames: reglas de pantalla', () => {
  it('dice qué pasos de la contención faltan y solo deja contener con todos confirmados', () => {
    const faltan = { estado: 'activo' as const, checklist: [paso('A', true), paso('B', false)] };
    expect(pasosPendientes(faltan)).toEqual(['B']);
    expect(puedeContener(faltan)).toBe(false);
    const completo = { estado: 'activo' as const, checklist: [paso('A', true), paso('B', true)] };
    expect(puedeContener(completo)).toBe(true);
    // ya contenido, o sin checklist cargado: no se ofrece contener
    expect(puedeContener({ ...completo, estado: 'contenido' })).toBe(false);
    expect(puedeContener({ estado: 'activo', checklist: [] })).toBe(false);
  });

  it('el volumen real se confirma solo con el derrame contenido', () => {
    expect(puedeConfirmarVolumen({ estado: 'activo' })).toBe(false);
    expect(puedeConfirmarVolumen({ estado: 'contenido' })).toBe(true);
    expect(puedeConfirmarVolumen({ estado: 'cerrado' })).toBe(false);
  });

  it('informa el plazo de 5 minutos sin bloquear', () => {
    expect(textoPlazoContencion({ contencionMinutos: null, contencionEnPlazo: null })).toBeNull();
    expect(textoPlazoContencion({ contencionMinutos: 3.5, contencionEnPlazo: true })).toBe(
      'Contenido en 3.5 min (dentro del plazo de 5 min)',
    );
    expect(textoPlazoContencion({ contencionMinutos: 20, contencionEnPlazo: false })).toBe(
      'Contenido en 20 min (fuera del plazo de 5 min)',
    );
  });

  it('muestra los barriles y el rango de cada banda', () => {
    expect(formatoBarriles(null)).toBe('Sin confirmar');
    expect(formatoBarriles(7)).toBe('7 bbl');
    expect(rangoDeBanda({ desdeBarriles: 1, hastaBarriles: 5 })).toBe('1 a 5 bbl');
    expect(rangoDeBanda({ desdeBarriles: 5, hastaBarriles: null })).toBe('5 bbl o más');
  });

  it('lee el volumen con coma o punto decimal y rechaza lo que no es un número válido', () => {
    expect(leerBarriles('2,5')).toBe(2.5);
    expect(leerBarriles(' 3 ')).toBe(3);
    expect(leerBarriles('0')).toBe(0);
    expect(leerBarriles('')).toBeNull();
    expect(leerBarriles('-1')).toBeNull();
    expect(leerBarriles('mucho')).toBeNull();
  });
});
