/**
 * Plantillas de carga masiva (actividades diarias de FCR/Pumping, partes del
 * checklist de inspección) — CSV en vez de .xlsx real: se abre igual en
 * Excel y no requiere sumar una librería de hojas de cálculo al proyecto.
 */

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Dispara la descarga de un CSV (Blob + `<a download>`, mismo patrón que el resto de descargas del proyecto). BOM UTF-8 para que Excel no rompa tildes/ñ. */
export function descargarCsv(filename: string, rows: string[][]): void {
  const csv = rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
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
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
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
