import type { ActividadTabla } from '../models/operativo-docs.model';

/** Modelos de tabla que repiten las que los Reportes Job reales de Pumping arman dentro de una actividad. */
export const TABLAS_PLANTILLA: { id: string; label: string; crear: () => ActividadTabla }[] = [
  {
    id: 'resumen-dia',
    label: 'Resumen del día',
    crear: () => ({
      titulo: 'RESUMEN DEL DÍA (PROFUNDIDAD, BOMBEO, HORAS DE EQUIPOS, MAQUINARIA, TANQUES Y PERSONAL)',
      columnas: ['Concepto', 'Cantidad', 'Unidad / detalle'],
      filas: [
        ['', '', ''],
        ['', '', ''],
        ['', '', ''],
      ],
    }),
  },
  {
    id: 'bombeo',
    label: 'Bombeo por tramo',
    crear: () => ({
      titulo: 'BOMBEO',
      columnas: ['Directa · Tipo de fluido', 'Directa · Volumen (bbl)', 'Anular · Tipo de fluido', 'Anular · Volumen (bbl)'],
      filas: [
        ['', '', '', ''],
        ['', '', '', ''],
      ],
    }),
  },
  {
    id: 'vacia',
    label: 'Tabla en blanco',
    crear: () => ({ titulo: '', columnas: ['Columna 1', 'Columna 2'], filas: [['', ''], ['', '']] }),
  },
];

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
