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
