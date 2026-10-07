import type { ActividadTabla } from '../models/operativo-docs.model';

/** Tabla nueva en blanco: dos columnas y dos filas — título, encabezados, filas y columnas se editan después. */
export function crearTablaVacia(): ActividadTabla {
  return { titulo: '', columnas: ['Columna 1', 'Columna 2'], filas: [['', ''], ['', '']] };
}

/**
 * Convierte filas consecutivas del Excel (las celdas a la derecha del detalle) en una tabla: la primera fila es el
 * encabezado y el resto los datos; las columnas que quedan vacías en todas las filas (celdas combinadas) se descartan.
 * `null` si no alcanza para una tabla (menos de 2 filas o menos de 2 columnas con datos).
 */
export function tablaDesdeFilas(filas: string[][]): ActividadTabla | null {
  const limpias = filas.map(f => f.map(c => c.trim()));
  const ancho = Math.max(0, ...limpias.map(f => f.length));
  const usadas = Array.from({ length: ancho }, (_, i) => i).filter(i => limpias.some(f => (f[i] ?? '') !== ''));
  if (limpias.length < 2 || usadas.length < 2) return null;
  const matriz = limpias.map(f => usadas.map(i => f[i] ?? ''));
  const [encabezado, ...datos] = matriz;
  return {
    titulo: '',
    columnas: encabezado.map((c, i) => c || `Columna ${i + 1}`),
    filas: datos,
  };
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
