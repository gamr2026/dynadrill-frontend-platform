/**
 * Documentos operativos que se llenan en campo y que Facturación consume:
 *
 * - **Reporte Diario de Actividades de Operaciones** (DYN-SGI-RE-047) — la bitácora horaria.
 * - **Reporte Diario de Herramientas en Renta** (DYN-FCR-RE-008) — matriz herramienta × día
 *   con estado O/S/D/V.
 *
 * Vive en `shared/` porque lo producen FCR y Pumping y lo lee Facturación,
 * sin que ninguno dependa del otro. FCR mantiene alias `Fcr*` sobre estos tipos.
 */

// ── Reporte de Herramientas — estado diario por herramienta ──

export type ToolDailyStatus = 'operacion' | 'stand_by' | 'daily_charge' | 'venta';

export const TOOL_DAILY_STATUS_LABELS: Record<ToolDailyStatus, string> = {
  operacion: 'En operación',
  stand_by: 'Stand-by',
  daily_charge: 'Daily charge',
  venta: 'Consumible / venta',
};

/** Código de una sola letra del DYN-FCR-RE-008 real. */
export const TOOL_DAILY_STATUS_CODE: Record<ToolDailyStatus, string> = {
  operacion: 'O',
  stand_by: 'S',
  daily_charge: 'D',
  venta: 'V',
};

export interface OperativoToolRef {
  id: number;
  name: string;
  serialCode?: string;
  /** Código de la lista de precios (columna "CODIGO #" del DYN-FCR-RE-008). */
  codigo?: string;
  /** Unidad del ítem de la lista de precios. */
  unidad?: string;
  /** Cantidad real de un ítem que no se marca por día (km, pies, galones, unidades…): sale en la columna TOTAL. */
  cantidad?: number | null;
}

/** Un registro por (herramienta, fecha); volver a registrar esa combinación reemplaza el estado del día. */
export interface OperativoToolUsageEntry {
  id: number;
  toolId: number;
  date: string;
  status: ToolDailyStatus;
}

// ── Reporte Job — bitácora horaria ──

/** Tabla dentro de una actividad (volúmenes de bombeo, resumen del día…) — como las de los Reportes Job reales. */
export interface ActividadTabla {
  titulo: string;
  columnas: string[];
  /** Una fila por renglón, con una celda por columna. */
  filas: string[][];
}

/** Una entrada de la bitácora — la duración se calcula, nunca se captura a mano. */
export interface OperativoActivityLogEntry {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  detail: string;
  author: string;
  /** Tablas de la actividad (opcional). */
  tablas?: ActividadTabla[];
}

// ── Cabecera común a los PDF operativos ──

export interface OperativoDocHeader {
  code: string;
  cliente: string;
  pozo: string;
  supervisor?: string;
  operador?: string;
}
