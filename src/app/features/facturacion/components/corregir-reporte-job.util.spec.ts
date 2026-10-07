import { filaActividadValida, filasActividadValidas } from './corregir-reporte-job.util';

describe('filaActividadValida', () => {
  it('acepta inicio y fin HH:mm con detalle', () => {
    expect(filaActividadValida({ startTime: '07:00', endTime: '12:30', detail: 'Arma BHA' })).toBe(true);
  });

  it('rechaza la hora incompleta (solo la hora, sin minutos elegidos)', () => {
    expect(filaActividadValida({ startTime: '07:', endTime: '12:30', detail: 'Arma BHA' })).toBe(false);
  });

  it('rechaza el fin vacío', () => {
    expect(filaActividadValida({ startTime: '07:00', endTime: '', detail: 'Arma BHA' })).toBe(false);
  });

  it('rechaza el detalle vacío o solo espacios', () => {
    expect(filaActividadValida({ startTime: '07:00', endTime: '12:30', detail: '   ' })).toBe(false);
  });
});

describe('filasActividadValidas', () => {
  it('es válida una lista vacía (el día queda sin actividades, con confirmación aparte)', () => {
    expect(filasActividadValidas([])).toBe(true);
  });

  it('es inválida si alguna fila lo es', () => {
    expect(
      filasActividadValidas([
        { startTime: '07:00', endTime: '08:00', detail: 'Ok' },
        { startTime: '08:00', endTime: '', detail: 'Sin fin' },
      ]),
    ).toBe(false);
  });
});
