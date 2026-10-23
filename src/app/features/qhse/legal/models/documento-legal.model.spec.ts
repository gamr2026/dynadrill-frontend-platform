import { describe, expect, it } from 'vitest';
import { textoDeVigencia } from './documento-legal.model';

describe('Requisitos legales: reglas de pantalla', () => {
  it('sin vencimiento no habla de días', () => {
    expect(textoDeVigencia({ estadoVigencia: 'sin_vencimiento', diasParaVencer: null })).toBe(
      'Sin vencimiento',
    );
  });

  it('una revisión sin vigencia evaluada (reemplazada o sin dato) se muestra sin vencimiento', () => {
    expect(textoDeVigencia({ estadoVigencia: null, diasParaVencer: null })).toBe('Sin vencimiento');
  });

  it('cuenta los días que faltan, con singular y plural', () => {
    expect(textoDeVigencia({ estadoVigencia: 'vigente', diasParaVencer: 90 })).toBe(
      'Vence en 90 días',
    );
    expect(textoDeVigencia({ estadoVigencia: 'por_vencer', diasParaVencer: 1 })).toBe(
      'Vence en 1 día',
    );
    expect(textoDeVigencia({ estadoVigencia: 'por_vencer', diasParaVencer: 0 })).toBe('Vence hoy');
  });

  it('una revisión vencida dice hace cuánto', () => {
    expect(textoDeVigencia({ estadoVigencia: 'vencido', diasParaVencer: -1 })).toBe(
      'Venció hace 1 día',
    );
    expect(textoDeVigencia({ estadoVigencia: 'vencido', diasParaVencer: -12 })).toBe(
      'Venció hace 12 días',
    );
  });
});
