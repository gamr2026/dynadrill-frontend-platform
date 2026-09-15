import { Workbook, Worksheet } from 'exceljs';
import { calcularNP, calcularNR, ControlType, GtcEvaluacion, interpretarNP, interpretarNR, IpercHazard, IpercMatrix } from '../models/iperc.model';

/**
 * Exporta un .xlsx real que clona el formato oficial DYN-SGI-RE-087 (GTC 45)
 * — usa `exceljs` (no el `xlsx`/SheetJS ya presente en el proyecto: su
 * edición gratuita no escribe estilos al guardar, confirmado leyendo el
 * `styles.xml` de una prueba: colapsaba a 2 formatos genéricos). La
 * plantilla en `/plantillas/iperc-matriz-gtc45.xlsx` es una versión
 * recortada del archivo real (solo cabecera, leyenda ND/NE/NC y 1 fila de
 * datos en blanco que sirve de molde de estilo) — NO tiene ninguna de las
 * ~885 filas históricas reales de la empresa, ver el script que la generó.
 *
 * Mapeo de columnas verificado a mano contra el archivo original (hoja
 * "GTC 45 - Julio 2026", filas 18-19 = encabezados). Columnas del Excel
 * sin equivalente en el modelo actual (Rutinaria, Área/Puesto de trabajo,
 * Cargos expuestos, Generado en, Efectos posibles) quedan en blanco.
 */
const TEMPLATE_URL = '/plantillas/iperc-matriz-gtc45.xlsx';
const SHEET_NAME = 'GTC 45 - Julio 2026';
const MOLDE_ROW = 20;
const LAST_COL = 45; // AS

interface HazardRow {
  tarea: string;
  hazard: IpercHazard;
}

function controlesDe(hazard: IpercHazard, tipo: ControlType): string {
  return hazard.controles
    .filter(c => c.type === tipo)
    .map(c => c.description)
    .join('; ');
}

function setEvaluacion(
  ws: Worksheet,
  row: number,
  cols: { nd: string; ne: string; np: string; interpNp?: string; nc: string; nr: string; interpNr?: string; aceptabilidad: string },
  ev: GtcEvaluacion,
): void {
  ws.getCell(`${cols.nd}${row}`).value = ev.nd ?? undefined;
  ws.getCell(`${cols.ne}${row}`).value = ev.ne ?? undefined;
  ws.getCell(`${cols.nc}${row}`).value = ev.nc ?? undefined;
  const np = calcularNP(ev.nd, ev.ne);
  ws.getCell(`${cols.np}${row}`).value = np ?? undefined;
  if (cols.interpNp) ws.getCell(`${cols.interpNp}${row}`).value = np != null ? interpretarNP(np).label : undefined;
  const nr = calcularNR(ev.nd, ev.ne, ev.nc);
  ws.getCell(`${cols.nr}${row}`).value = nr ?? undefined;
  const nrInfo = nr != null ? interpretarNR(nr) : null;
  if (cols.interpNr) ws.getCell(`${cols.interpNr}${row}`).value = nrInfo?.nivel;
  ws.getCell(`${cols.aceptabilidad}${row}`).value = nrInfo?.aceptabilidad;
}

function setHazardRow(ws: Worksheet, excelRow: number, matrix: IpercMatrix, row: HazardRow): void {
  const h = row.hazard;
  ws.getCell(`B${excelRow}`).value = matrix.ubicacion;
  ws.getCell(`C${excelRow}`).value = matrix.actividad;
  ws.getCell(`D${excelRow}`).value = row.tarea;
  ws.getCell(`H${excelRow}`).value = h.peligro;
  ws.getCell(`I${excelRow}`).value = h.clasificacionPeligro;
  ws.getCell(`J${excelRow}`).value = h.fuenteRiesgo;
  ws.getCell(`M${excelRow}`).value = h.controlesExistentes;

  setEvaluacion(ws, excelRow, { nd: 'P', ne: 'Q', np: 'R', interpNp: 'S', nc: 'T', nr: 'U', interpNr: 'V', aceptabilidad: 'W' }, h.riesgoInicial);

  ws.getCell(`X${excelRow}`).value = h.numeroExpuestos;
  ws.getCell(`Y${excelRow}`).value = h.peorConsecuencia;
  ws.getCell(`Z${excelRow}`).value = h.requisitoLegal === true ? 'SI' : h.requisitoLegal === false ? 'NO' : undefined;

  ws.getCell(`AA${excelRow}`).value = controlesDe(h, 'eliminacion');
  ws.getCell(`AB${excelRow}`).value = controlesDe(h, 'sustitucion');
  ws.getCell(`AC${excelRow}`).value = controlesDe(h, 'ingenieria');
  ws.getCell(`AD${excelRow}`).value = controlesDe(h, 'administrativo');
  ws.getCell(`AE${excelRow}`).value = controlesDe(h, 'epp');

  setEvaluacion(ws, excelRow, { nd: 'AG', ne: 'AH', np: 'AI', interpNp: 'AJ', nc: 'AK', nr: 'AL', aceptabilidad: 'AM' }, h.riesgoResidual);

  // "Tipo de Control Propuesto" — segundo bloque del Excel real, misma info que Eliminación..EPP de arriba.
  ws.getCell(`AN${excelRow}`).value = controlesDe(h, 'eliminacion');
  ws.getCell(`AO${excelRow}`).value = controlesDe(h, 'sustitucion');
  ws.getCell(`AP${excelRow}`).value = controlesDe(h, 'ingenieria');
  ws.getCell(`AQ${excelRow}`).value = controlesDe(h, 'administrativo');
  ws.getCell(`AR${excelRow}`).value = controlesDe(h, 'epp');
}

export async function exportarMatrizIpercXlsx(matrix: IpercMatrix): Promise<void> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla (${res.status}).`);
  const buffer = await res.arrayBuffer();

  const wb = new Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`La plantilla no tiene la hoja "${SHEET_NAME}".`);

  ws.getCell('C6').value = new Date(matrix.updatedAt);
  ws.getCell('C7').value = matrix.equipoEvaluador.join(', ') || undefined;
  ws.getCell('C10').value = matrix.ubicacion;

  const hazardRows: HazardRow[] = matrix.tasks.flatMap(t => t.hazards.map(hazard => ({ tarea: t.descripcion, hazard })));
  const moldeRow = ws.getRow(MOLDE_ROW);

  hazardRows.forEach((row, i) => {
    const excelRow = MOLDE_ROW + i;
    if (i > 0) {
      // Clona el estilo (bordes, relleno, fuente) de la fila molde — nunca se crea una celda "de la nada" sin estilo.
      const newRow = ws.getRow(excelRow);
      for (let c = 1; c <= LAST_COL; c++) {
        newRow.getCell(c).style = moldeRow.getCell(c).style;
      }
      newRow.height = moldeRow.height;
    }
    setHazardRow(ws, excelRow, matrix, row);
  });

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Matriz IPERC ${matrix.code}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
