import type { ActividadTabla } from '../models/operativo-docs.model';
import { TABLAS_PLANTILLA, limpiarTablas, tablaATexto } from './actividad-tablas';

describe('limpiarTablas', () => {
  it('descarta las tablas sin ningún dato (recién agregadas y sin llenar)', () => {
    const vacia = TABLAS_PLANTILLA[0].crear();
    expect(limpiarTablas([vacia])).toEqual([]);
  });

  it('descarta las filas vacías y recorta los textos', () => {
    const t: ActividadTabla = {
      titulo: '  BOMBEO ',
      columnas: [' Fluido ', 'Volumen'],
      filas: [
        [' Agua fresca ', ' 211 '],
        ['', ''],
      ],
    };
    expect(limpiarTablas([t])).toEqual([{ titulo: 'BOMBEO', columnas: ['Fluido', 'Volumen'], filas: [['Agua fresca', '211']] }]);
  });

  it('completa las celdas que falten para que cada fila tenga tantas como columnas', () => {
    const t: ActividadTabla = { titulo: '', columnas: ['A', 'B', 'C'], filas: [['x']] };
    expect(limpiarTablas([t])[0].filas).toEqual([['x', '', '']]);
  });

  it('acepta undefined', () => {
    expect(limpiarTablas(undefined)).toEqual([]);
  });
});

describe('tablaATexto', () => {
  it('arma título, encabezados y filas', () => {
    expect(tablaATexto({ titulo: 'T', columnas: ['A', 'B'], filas: [['1', '2']] })).toBe('T\nA | B\n1 | 2');
  });

  it('sin título no deja línea vacía', () => {
    expect(tablaATexto({ titulo: '', columnas: ['A'], filas: [['1']] })).toBe('A\n1');
  });
});
