/**
 * HSE-SEGUIMIENTO-001 — Inspecciones de campo. A diferencia de STOP/SWA,
 * esto SÍ requiere criterio técnico (vigencia trimestral, bump test de
 * detectores de gas, cuarentena por rechazo) — no es una acción de
 * "cualquier trabajador", pero el registro base (Personal Operativo:
 * "Realiza inspecciones pre-operacionales diarias") sí queda accesible
 * desde "Reportar" sin pasar por el roleGuard de QHSE, igual que STOP/SWA;
 * la bandeja de cuarentena y vigencias queda para el staff HSE.
 */
export type TipoEquipoInspeccion = 'eslinga_cable' | 'detector_gas' | 'vehiculo_grua';

export const TIPO_EQUIPO_LABELS: Record<TipoEquipoInspeccion, string> = {
  eslinga_cable: 'Eslinga de cable',
  detector_gas: 'Detector de gas',
  vehiculo_grua: 'Vehículo-grúa',
};

/** Criterios de rechazo por tipo de equipo — cualquier ítem marcado "falla" rechaza el equipo completo. */
export const CRITERIOS_RECHAZO: Record<TipoEquipoInspeccion, string[]> = {
  eslinga_cable: [
    'Sin hilos rotos, cocas ni aplastamientos',
    'Ganchos con seguro funcional, sin deformación',
    'Etiqueta de capacidad (WLL) legible',
    'Sin corrosión ni decoloración por calor',
  ],
  detector_gas: [
    'Bump test vigente (últimas 24 h)',
    'Batería con carga suficiente para el turno',
    'Sensores sin daño físico ni obstrucción',
    'Calibración dentro del período del fabricante',
  ],
  vehiculo_grua: [
    'Frenos, luces y cinturones operativos',
    'Estabilizadores y niveles sin fugas',
    'Cable/pluma sin daño visible',
    'Documentos de la unidad vigentes',
  ],
};

export type InspeccionResultado = 'aprobado' | 'rechazado';

export interface InspeccionCriterioItem {
  label: string;
  checked: boolean;
}

export interface InspeccionEquipo {
  id: number;
  code: string;
  tipo: TipoEquipoInspeccion;
  equipoCodigo: string;
  inspectorNombre: string;
  fecha: string;
  criterios: InspeccionCriterioItem[];
  resultado: InspeccionResultado;
  /** Solo detector_gas — HSE-SEGUIMIENTO-001 exige bump test antes de cada uso. */
  bumpTestRealizado?: boolean;
  /** Vigencia trimestral (RN de HSE-SEGUIMIENTO-001) — se calcula al crear, no se recalcula después. */
  vigenciaHasta: string;

  /**
   * HSE-004: un vehículo-grúa rechazado es una solicitud de reparación —
   * genera un Reporte de Unidad en la bandeja de Mantenimiento (misma
   * bandeja y flujo que un reporte de Pumping/FCR: Orden + sub-órdenes). El
   * seguimiento posterior vive ahí, no en la inspección.
   */
  requiereMantenimiento?: boolean;
}

export type CreateInspeccionInput = Omit<InspeccionEquipo, 'id' | 'code' | 'vigenciaHasta'>;

export function inspeccionVigenciaHasta(fechaIso: string): string {
  const d = new Date(fechaIso);
  d.setMonth(d.getMonth() + 3);
  return d.toISOString();
}

export function inspeccionEnCuarentena(i: Pick<InspeccionEquipo, 'resultado'>): boolean {
  return i.resultado === 'rechazado';
}

export function inspeccionVencida(i: Pick<InspeccionEquipo, 'vigenciaHasta'>, ahora = new Date()): boolean {
  return new Date(i.vigenciaHasta).getTime() < ahora.getTime();
}

/**
 * HSE-SEGUIMIENTO-001 no exige la misma cadencia para los 3 tipos: grúa y
 * detector de gas son de control DIARIO (checklist pre-operacional / bump
 * test), mientras que eslinga de cable sigue el código de colores
 * TRIMESTRAL. `vigenciaHasta` (3 meses fijos, arriba) es el límite máximo
 * antes de exigir una reinspección completa para cualquier tipo — esto es
 * la cadencia real de control periódico, más corta para los dos tipos de
 * uso diario. "Planificar inspecciones del período" (HSE-SEGUIMIENTO-001)
 * se resuelve con esto: no hay inventario de equipos separado, así que el
 * cronograma se deriva del propio historial de inspecciones por
 * equipoCodigo — ver inspeccionesPorEquipo() en inspeccion-list-page.
 */
export const INSPECCION_FRECUENCIA_DIAS: Record<TipoEquipoInspeccion, number> = {
  vehiculo_grua: 1,
  detector_gas: 1,
  eslinga_cable: 90,
};

export const INSPECCION_FRECUENCIA_LABEL: Record<TipoEquipoInspeccion, string> = {
  vehiculo_grua: 'Diaria (checklist pre-operacional)',
  detector_gas: 'Diaria (bump test antes del turno)',
  eslinga_cable: 'Trimestral (código de colores)',
};

export function proximaInspeccionDebida(ultimaFechaIso: string, tipo: TipoEquipoInspeccion): string {
  const d = new Date(ultimaFechaIso);
  d.setDate(d.getDate() + INSPECCION_FRECUENCIA_DIAS[tipo]);
  return d.toISOString();
}

export function inspeccionPeriodicaVencida(ultimaFechaIso: string, tipo: TipoEquipoInspeccion, ahora = new Date()): boolean {
  return new Date(proximaInspeccionDebida(ultimaFechaIso, tipo)).getTime() < ahora.getTime();
}
