import type { ActividadTabla } from '../models/operativo-docs.model';
import { crearTablaVacia, limpiarTablas, tablaATexto, tablasDesdeHoja } from './actividad-tablas';

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

/** Una fila de la hoja «Tablas»: columna A + 8 celdas de datos. */
const fila = (a: string, ...resto: string[]): string[] => [a, ...resto, ...Array(Math.max(0, 8 - resto.length)).fill('')];

describe('tablasDesdeHoja (hoja «Tablas» del formato)', () => {
  it('lee un bloque: N° de actividad, título, encabezados y filas de datos', () => {
    const { tablas, sinActividad } = tablasDesdeHoja([
      fila('Instrucciones…'),
      fila('TABLA', '2', 'BOMBEO'),
      fila('Encabezados', 'Tipo de fluido', 'Volumen (bbl)'),
      fila('Datos', 'Agua fresca', '211'),
      fila('', 'Colchón mecánico', '20'),
      fila(''),
    ]);
    expect(sinActividad).toBe(0);
    expect(tablas).toEqual([
      {
        actividad: 2,
        tabla: { titulo: 'BOMBEO', columnas: ['Tipo de fluido', 'Volumen (bbl)'], filas: [['Agua fresca', '211'], ['Colchón mecánico', '20']] },
      },
    ]);
  });

  it('ignora los bloques en blanco que trae el formato y lee varios bloques seguidos', () => {
    const { tablas } = tablasDesdeHoja([
      fila('TABLA', '', ''),
      fila('Encabezados'),
      fila('Datos'),
      fila(''),
      fila('TABLA', '1', 'A'),
      fila('Encabezados', 'x', 'y'),
      fila('Datos', '1', '2'),
      fila('TABLA', '3', 'B'),
      fila('Encabezados', 'z'),
      fila('Datos', '9'),
    ]);
    expect(tablas.map(t => [t.actividad, t.tabla.titulo])).toEqual([[1, 'A'], [3, 'B']]);
  });

  it('un bloque con datos pero sin N° de actividad válido se cuenta aparte, no se pierde en silencio', () => {
    const { tablas, sinActividad } = tablasDesdeHoja([fila('TABLA', 'uno', 'X'), fila('Encabezados', 'a'), fila('Datos', '1')]);
    expect(tablas).toEqual([]);
    expect(sinActividad).toBe(1);
  });

  it('recorta las columnas vacías del final y nombra los encabezados que falten', () => {
    const { tablas } = tablasDesdeHoja([fila('TABLA', '1'), fila('Encabezados', 'A', '', 'C'), fila('Datos', '1', '2', '3')]);
    expect(tablas[0].tabla.columnas).toEqual(['A', 'Columna 2', 'C']);
    expect(tablas[0].tabla.filas).toEqual([['1', '2', '3']]);
  });

  it('el bloque termina en la primera fila en blanco', () => {
    const { tablas } = tablasDesdeHoja([fila('TABLA', '1'), fila('Encabezados', 'A'), fila('Datos', '1'), fila(''), fila('', 'suelto')]);
    expect(tablas[0].tabla.filas).toEqual([['1']]);
  });
});
