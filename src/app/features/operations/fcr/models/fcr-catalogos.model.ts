// ── Catálogos fijos compartidos por las dos entradas del FcrTicket (VENTA/SERVICIOS) ──
// Valores en sync manual con dynadrill-backend: libs/domains/operaciones/src/fcr-tickets/catalogos/*.catalog.ts

/** Especialidad del operador asignado a la entrada SERVICIOS (fase `tipo_operador`). */
export type TipoOperador = 'mecanico' | 'soldador';

export const TIPO_OPERADOR_LABELS: Record<TipoOperador, string> = {
  mecanico: 'Mecánico',
  soldador: 'Soldador',
};

/** Tipo de completación — entrada VENTA, capturado en el tronco compartido (`ejecucion_campo`). */
export type TipoCompletacion = 'selectiva' | 'inyeccion' | 'power_oil';

export const TIPO_COMPLETACION_LABELS: Record<TipoCompletacion, string> = {
  selectiva: 'Selectiva',
  inyeccion: 'Inyección',
  power_oil: 'Power OIL',
};

/** Tamaño de picker — común a ambas entradas, capturado en el tronco compartido (`ejecucion_campo`). */
export type TipoPicker = '7/8' | '9.5/8' | '5.5/8' | '5/8';

export const TIPO_PICKER_LABELS: Record<TipoPicker, string> = {
  '7/8': '7/8"',
  '9.5/8': '9.5/8"',
  '5.5/8': '5.5/8"',
  '5/8': '5/8"',
};

/** Tipo de trabajo — entrada SERVICIOS, capturado en el tronco compartido (`ejecucion_campo`). */
export type TipoTrabajo = 'fractura' | 'estimulacion' | 'evaluacion' | 'cemento' | 'picking';

export const TIPO_TRABAJO_LABELS: Record<TipoTrabajo, string> = {
  fractura: 'Fractura',
  estimulacion: 'Estimulación',
  evaluacion: 'Evaluación',
  cemento: 'Cemento',
  picking: 'Picking',
};
