/**
 * Para cada índice, cuántas filas hacia abajo (incluida esta) comparten la
 * misma clave consecutiva — 0 si esta fila queda "cubierta" por el
 * agrupamiento de una fila anterior. Mismo criterio visual que el Excel
 * real DYN-SGI-RE-087: Proceso/Zona/Actividad/Tarea repetidos en filas
 * consecutivas se combinan en una sola celda (rowspan en la vista de
 * impresión, `mergeCells` en el .xlsx exportado) en vez de repetirse en
 * cada fila de peligro.
 */
export function computeRowSpans<T>(items: readonly T[], keyFn: (item: T) => string): number[] {
  const spans = new Array(items.length).fill(0);
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && keyFn(items[j]) === keyFn(items[i])) j++;
    spans[i] = j - i;
    i = j;
  }
  return spans;
}
