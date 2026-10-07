import type { ActividadTabla } from '../models/operativo-docs.model';
import { crearTablaVacia, limpiarTablas, tablaATexto, tablaDesdeFilas } from './actividad-tablas';

describe('limpiarTablas', () => {
  it('descarta las tablas sin ningún dato (recién agregadas y sin llenar)', () => {
    expect(limpiarTablas([crearTablaVacia()])).toEqual([]);
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

describe('tablaDesdeFilas (tablas que vienen dentro del Excel)', () => {
  it('toma la primera fila como encabezado y descarta las columnas vacías por celdas combinadas', () => {
    const t = tablaDesdeFilas([
      ['Tipo de Fluido', 'Volumen (bbl)', 'Tipo de fluido', '', 'Volumen (bbl)'],
      ['Agua Fresca', '211', 'Colchón mecánico', '', '20'],
      ['', '', 'Agua Fresca', '', '189.5'],
    ]);
    expect(t).toEqual({
      titulo: '',
      columnas: ['Tipo de Fluido', 'Volumen (bbl)', 'Tipo de fluido', 'Volumen (bbl)'],
      filas: [
        ['Agua Fresca', '211', 'Colchón mecánico', '20'],
        ['', '', 'Agua Fresca', '189.5'],
      ],
    });
  });

  it('una sola fila no alcanza para una tabla', () => {
    expect(tablaDesdeFilas([['A', 'B']])).toBeNull();
  });

  it('con una sola columna con datos no es tabla', () => {
    expect(tablaDesdeFilas([['A', ''], ['B', '']])).toBeNull();
  });

  it('un encabezado vacío recibe un nombre', () => {
    expect(tablaDesdeFilas([['A', ''], ['1', '2']])?.columnas).toEqual(['A', 'Columna 2']);
  });
});
