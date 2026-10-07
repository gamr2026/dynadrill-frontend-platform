import type { ActividadTabla } from '../models/operativo-docs.model';

/** Tabla nueva en blanco: dos columnas y dos filas — título, encabezados, filas y columnas se editan después. */
export function crearTablaVacia(): ActividadTabla {
  return { titulo: '', columnas: ['Columna 1', 'Columna 2'], filas: [['', ''], ['', '']] };
}

/** Cuántas columnas de datos admite un bloque de la hoja «Tablas» del formato (B a I). */
export const COLUMNAS_HOJA_TABLAS = 8;

/** Nombre de la hoja del formato donde van las tablas de las actividades. */
export const NOMBRE_HOJA_TABLAS = 'Tablas';

export interface TablaDeHoja {
  /** N.° de actividad (1 = la primera actividad con datos del reporte). */
  actividad: number;
  tabla: ActividadTabla;
}

/**
 * Lee la hoja «Tablas» del formato DYN-SGI-RE-047 (filas ya leídas con `sheet_to_json(header: 1)`). Cada tabla es un
 * bloque:
 *   fila «TABLA»  →  col. A = `TABLA`, B = N.° de actividad, C = título (opcional)
 *   fila siguiente →  encabezados de las columnas (B a I)
 *   filas siguientes → una por renglón de datos (B a I), hasta una fila en blanco o el próximo bloque
 * Los bloques sin datos se ignoran en silencio (son los espacios que trae el formato). Los que tienen datos pero no un
 * N.° de actividad válido se cuentan en `sinActividad` para avisar al usuario.
 */
export function tablasDesdeHoja(filas: string[][]): { tablas: TablaDeHoja[]; sinActividad: number } {
  const texto = (f: string[] | undefined, i: number): string => (f?.[i] ?? '').toString().trim();
  const celdas = (f: string[] | undefined): string[] => Array.from({ length: COLUMNAS_HOJA_TABLAS }, (_, i) => texto(f, i + 1));
  const esInicio = (f: string[] | undefined): boolean => texto(f, 0).toUpperCase() === 'TABLA';

  const tablas: TablaDeHoja[] = [];
  let sinActividad = 0;
  for (let i = 0; i < filas.length; i++) {
    if (!esInicio(filas[i])) continue;
    const numero = Number.parseInt(texto(filas[i], 1), 10);
    const titulo = texto(filas[i], 2);
    const encabezados = celdas(filas[i + 1]);
    const datos: string[][] = [];
    let j = i + 2;
    while (j < filas.length && !esInicio(filas[j]) && celdas(filas[j]).some(c => c !== '')) {
      datos.push(celdas(filas[j]));
      j++;
    }
    if (!datos.length) continue;
    if (!Number.isInteger(numero) || numero < 1) {
      sinActividad++;
      continue;
    }
    const ancho = Math.max(...[encabezados, ...datos].map(f => f.reduce((max, c, k) => (c !== '' ? k + 1 : max), 0)));
    tablas.push({
      actividad: numero,
      tabla: {
        titulo,
        columnas: encabezados.slice(0, ancho).map((c, k) => c || `Columna ${k + 1}`),
        filas: datos.map(f => f.slice(0, ancho)),
      },
    });
  }
  return { tablas, sinActividad };
}

/** Deja solo las tablas con algún dato (una tabla recién agregada y sin llenar no se envía) y recorta los textos. */
export function limpiarTablas(tablas: ActividadTabla[] | undefined): ActividadTabla[] {
  return (tablas ?? [])
    .map(t => ({
      titulo: t.titulo.trim(),
      columnas: t.columnas.map(c => c.trim()),
      filas: t.filas.map(f => t.columnas.map((_, i) => (f[i] ?? '').trim())).filter(f => f.some(c => c !== '')),
    }))
    .filter(t => t.filas.length > 0);
}

/** Texto plano de una tabla (para exportar a Excel): título, encabezados y una línea por fila, separadas por " | ". */
export function tablaATexto(t: ActividadTabla): string {
  const lineas = [...(t.titulo ? [t.titulo] : []), t.columnas.join(' | '), ...t.filas.map(f => f.join(' | '))];
  return lineas.join('\n');
}
