import { describe, expect, it } from 'vitest';
import type { AlertaPreventivaFlota, PreventivoFlota } from '../../flota/models/unidad-flota.model';
import { alertaDesdeFlota, registroDesdePreventivo } from './flota-mantenimiento.mapper';

const base: AlertaPreventivaFlota = {
  unidad: { id: 'u-1', codigo: 'PUM-07', nombre: 'Unidad de Bombeo PUM-07', tipo: 'servicio' },
  reglaCodigo: 'servicio_a',
  descripcion: 'Tipo A (250 h)',
  metrica: 'horas',
  tipoServicio: 'a',
  consumido: 200,
  intervalo: 250,
  restante: 50,
  valorActual: 1480,
  nivel: 'verde',
  enVentana: false,
};

describe('alertaDesdeFlota', () => {
  it('traduce el código de Flota a los textos de la pantalla', () => {
    expect(alertaDesdeFlota(base)).toMatchObject({
      unidadId: 'u-1',
      unidadCode: 'PUM-07',
      unidadTipo: 'Servicio',
      unidad: 'horas',
      actualLabel: '1.480 h',
      proximoEn: '50 h',
      tipoServicio: 'A',
      nivel: 'verde',
    });
  });

  it('distingue «en ventana de tolerancia» de «vencido»', () => {
    expect(
      alertaDesdeFlota({ ...base, restante: -10, enVentana: true, nivel: 'amarillo' }).proximoEn,
    ).toBe('En ventana (10 h sobre lo previsto)');
    expect(
      alertaDesdeFlota({ ...base, restante: -80, enVentana: false, nivel: 'rojo' }).proximoEn,
    ).toBe('Vencido');
  });

  it('las reglas por tiempo muestran los días transcurridos y nunca un consumo negativo', () => {
    const a = alertaDesdeFlota({
      ...base,
      metrica: 'dias',
      tipoServicio: null,
      consumido: -3,
      valorActual: null,
      restante: 183,
      intervalo: 180,
    });
    expect(a).toMatchObject({ unidad: 'días', consumido: 0, tipoServicio: undefined });
  });
});

describe('registroDesdePreventivo', () => {
  const p: PreventivoFlota = {
    id: 'p-1',
    tipoServicio: 'b',
    fecha: '2026-05-12',
    valor: 2000,
    ejecutadoPor: 'tercero',
    observaciones: null,
    proveedor: { id: 'v-1', nombre: 'Lubricentro Norte S.A.' },
    responsable: null,
  };

  it('pone la lectura como horómetro o kilometraje según el tipo de unidad', () => {
    expect(
      registroDesdePreventivo(p, { id: 'u-1', codigo: 'PUM-07', tipo: 'servicio' }),
    ).toMatchObject({ horometro: 2000, km: undefined, tipoServicio: 'B', clase: 'Preventivo' });
    expect(
      registroDesdePreventivo(p, { id: 'u-2', codigo: 'CAM-04', tipo: 'transporte' }),
    ).toMatchObject({ km: 2000, horometro: undefined });
  });

  it('un mantenimiento sin cuenta responsable es de la carga inicial', () => {
    expect(
      registroDesdePreventivo(p, { id: 'u-1', codigo: 'PUM-07', tipo: 'servicio' }),
    ).toMatchObject({
      responsable: 'Carga inicial',
      ejecutadoPor: 'Tercero',
      proveedor: 'Lubricentro Norte S.A.',
    });
  });
});
