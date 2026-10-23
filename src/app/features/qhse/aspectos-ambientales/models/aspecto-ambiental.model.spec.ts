import { describe, expect, it } from 'vitest';
import { escala1a5, nivelRiesgo, presupuestoDeTexto } from './aspecto-ambiental.model';

describe('Aspectos ambientales: reglas de pantalla', () => {
  it('el nivel de riesgo es probabilidad × consecuencia', () => {
    expect(nivelRiesgo(3, 4)).toBe(12);
    expect(nivelRiesgo(5, 5)).toBe(25);
  });

  it('probabilidad y consecuencia solo aceptan enteros de 1 a 5', () => {
    expect(escala1a5('1')).toBe(1);
    expect(escala1a5('5')).toBe(5);
    expect(escala1a5('0')).toBeNull();
    expect(escala1a5('6')).toBeNull();
    expect(escala1a5('2.5')).toBeNull();
    expect(escala1a5('')).toBeNull();
    expect(escala1a5('abc')).toBeNull();
  });

  it('el presupuesto vacío no se envía, uno válido se convierte y uno inválido se rechaza', () => {
    expect(presupuestoDeTexto('')).toBeUndefined();
    expect(presupuestoDeTexto('  ')).toBeUndefined();
    expect(presupuestoDeTexto('2500.5')).toBe(2500.5);
    expect(presupuestoDeTexto('2500,50')).toBe(2500.5);
    expect(presupuestoDeTexto('0')).toBe(0);
    expect(presupuestoDeTexto('-1')).toBeNull();
    expect(presupuestoDeTexto('10.123')).toBeNull();
    expect(presupuestoDeTexto('mucho')).toBeNull();
  });
});
