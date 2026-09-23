/**
 * Plantillas de carga masiva (actividades diarias de FCR/Pumping, partes del
 * checklist de inspección) — CSV en vez de .xlsx real: se abre igual en
 * Excel y no requiere sumar una librería de hojas de cálculo al proyecto.
 */

// ';' y no ',' — Excel abre un .csv por doble clic separando columnas según
// el "separador de listas" de la configuración regional de Windows, no por
// detección del archivo. En español (Ecuador incluido) esa configuración
// regional usa ',' como separador decimal, así que el separador de listas
// pasa a ser ';': un CSV con ',' se abre entero en una sola columna.
function escapeCsvCell(value: string): string {
  return /[;,\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Dispara la descarga de un CSV (Blob + `<a download>`, mismo patrón que el resto de descargas del proyecto). BOM UTF-8 para que Excel no rompa tildes/ñ. */
export function descargarCsv(filename: string, rows: string[][]): void {
  const csv = rows.map(row => row.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Parsea una línea CSV respetando comillas dobles (celdas con comas/saltos de línea). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ';') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Normaliza una celda de fecha de un CSV subido a formato ISO (`AAAA-MM-DD`).
 * Excel reformatea columnas de fecha a la configuración regional al abrir o
 * volver a guardar un CSV (en Ecuador, `D/M/AAAA`) aunque la plantilla se
 * haya descargado en ISO — sin esto, una fecha así llega intacta hasta el
 * backend y rompe cualquier `new Date(...)` downstream. `null` si no matchea
 * ningún formato reconocido (fila a rechazar, no a adivinar).
 */
export function normalizeFechaCsv(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  const [, dia, mes, anio] = match;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/** Lee un `File` (CSV) y devuelve sus filas ya separadas en celdas — la primera fila es el encabezado. */
export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r\n|\n|\r/).filter(line => line.length > 0);
      resolve(lines.map(parseCsvLine));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}
