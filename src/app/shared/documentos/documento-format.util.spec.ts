import { fechaDiaDoc } from './documento-format.util';

describe('fechaDiaDoc', () => {
  it('separador de día del Reporte Job con el formato del Excel (27-ago-2026)', () => {
    expect(fechaDiaDoc('2026-08-27')).toBe('27-ago-2026');
    expect(fechaDiaDoc('2026-01-05T10:00:00')).toBe('05-ene-2026');
    expect(fechaDiaDoc('2026-12-31')).toBe('31-dic-2026');
  });

  it('sin fecha válida no inventa nada', () => {
    expect(fechaDiaDoc(undefined)).toBe('');
    expect(fechaDiaDoc('sin fecha')).toBe('sin fecha');
  });
});
