import type { FilaPlantilla } from './pedido-comercial.model';

/** Cabecera real de la plantilla descargable de AS2 (hoja "Ventas") — "AS2 Pedido Cliente.xlsx". */
export const CABECERA_PLANTILLA_AS2 = 'Codigo Producto AS2';
/** El backend acepta hasta 500 filas por validación. */
export const MAX_FILAS_PLANTILLA = 500;

export interface ResultadoLecturaPlantilla {
  filas: FilaPlantilla[];
  /** Filas con cantidad ilegible (número de fila de la hoja, base 1 contando desde la cabecera). */
  ilegibles: { fila: number; codigo: string; motivo: string }[];
  /** Mensaje cuando la hoja no es la plantilla de AS2 o no trae líneas. */
  error: string | null;
}

/** Convierte "1,500.50", "1.500,50", "12,5" o "12" a número; `null` si no es un número. */
export function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let t = String(valor ?? '').trim().replace(/\s/g, '').replace(/^\$/, '');
  if (!t) return null;
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  if (coma !== -1 && punto !== -1) {
    // el último separador es el decimal
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma !== -1) {
    t = t.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/**
 * Lee las filas de la hoja "Ventas" de la plantilla de AS2: la cabecera "Codigo Producto AS2" en la primera columna y,
 * debajo, A código · B unidad · C cantidad · D descripción · E precio · F descuento (%). La primera fila sin código
 * cierra los datos. Solo se envían al backend código, cantidad, precio y descuento; el precio válido es el de la lista.
 */
export function leerFilasPlantillaAs2(hoja: readonly (readonly unknown[])[]): ResultadoLecturaPlantilla {
  const idx = hoja.findIndex(f => String(f[0] ?? '').trim() === CABECERA_PLANTILLA_AS2);
  if (idx === -1) {
    return { filas: [], ilegibles: [], error: `No se encontró el encabezado "${CABECERA_PLANTILLA_AS2}". ¿Es la plantilla de AS2 Pedido Cliente?` };
  }
  const filas: FilaPlantilla[] = [];
  const ilegibles: ResultadoLecturaPlantilla['ilegibles'] = [];
  let n = 0;
  for (const fila of hoja.slice(idx + 1)) {
    const codigo = String(fila[0] ?? '').trim();
    if (!codigo) break;
    n++;
    const cantidadTxt = String(fila[2] ?? '').trim();
    const cantidad = cantidadTxt === '' ? 1 : aNumero(fila[2]);
    if (cantidad === null || cantidad <= 0) {
      ilegibles.push({ fila: n, codigo, motivo: `Cantidad no válida: "${cantidadTxt}"` });
      continue;
    }
    const registro: FilaPlantilla = { codigo, cantidad };
    const precio = aNumero(fila[4]);
    if (precio !== null && precio >= 0) registro.precio = precio;
    const descuento = aNumero(fila[5]);
    if (descuento !== null && descuento >= 0 && descuento <= 100) registro.descuentoPct = descuento;
    filas.push(registro);
  }
  if (filas.length === 0 && ilegibles.length === 0) {
    return { filas, ilegibles, error: 'La plantilla no trae ninguna línea después del encabezado.' };
  }
  if (filas.length > MAX_FILAS_PLANTILLA) {
    return { filas: [], ilegibles, error: `La plantilla trae ${filas.length} líneas; el máximo es ${MAX_FILAS_PLANTILLA}.` };
  }
  return { filas, ilegibles, error: null };
}
