/**
 * HSE-MASTER-001 — "Dashboard Integrado del Sistema". El documento lista 16
 * indicadores en 4 categorías (Seguridad, Operacional, Ambiental, Cultura
 * Preventiva) más un semáforo Verde/Amarillo/Rojo por "indicadores fuera de
 * meta". Ningún proceso de QHSE registra horas-hombre trabajadas, así que
 * TRIR y LTIR no son calculables con datos reales del sistema — se
 * muestran marcados como "no disponible" en vez de inventar un número.
 * % de participación en STOP tampoco: las tarjetas guardan el observador
 * como texto libre (observadorNombre), no como referencia a un usuario del
 * sistema, así que no hay forma confiable de cruzarlo contra el módulo de
 * usuarios. % de personal capacitado tampoco: no existe ningún módulo de
 * capacitaciones/entrenamientos HSE en el sistema. STOP per cápita SÍ se
 * puede calcular — usa el conteo de usuarios activos (status=true) del
 * módulo de Usuarios como denominador (proxy razonable de headcount,
 * aunque no distinga personal de sitio vs. oficina). El resto de
 * indicadores se calcula en vivo a partir de los módulos ya construidos
 * (PTW, IPERC, Inspecciones, Desechos, Derrames, STOP, SWA, Investigaciones).
 */
export type DashboardKpiCategoria = 'Seguridad' | 'Operacional' | 'Ambiental' | 'Cultura Preventiva';

export type KpiDireccion = 'mayor_mejor' | 'menor_mejor';

export interface DashboardKpiDef {
  id: string;
  categoria: DashboardKpiCategoria;
  label: string;
  unidad: string;
  direccion: KpiDireccion;
  /** Si es false, el valor siempre es null: no hay datos suficientes en el sistema para calcularlo. */
  disponible: boolean;
  motivoNoDisponible?: string;
}

export const DASHBOARD_KPI_DEFS: DashboardKpiDef[] = [
  { id: 'trir', categoria: 'Seguridad', label: 'TRIR (Total Recordable Incident Rate)', unidad: 'x 200,000 h-h', direccion: 'menor_mejor', disponible: false, motivoNoDisponible: 'Requiere horas-hombre trabajadas — no se registran en el sistema.' },
  { id: 'ltir', categoria: 'Seguridad', label: 'LTIR (Lost Time Incident Rate)', unidad: 'x 200,000 h-h', direccion: 'menor_mejor', disponible: false, motivoNoDisponible: 'Requiere horas-hombre trabajadas — no se registran en el sistema.' },
  { id: 'dias_sin_lti', categoria: 'Seguridad', label: 'Días sin accidentes con tiempo perdido', unidad: 'días', direccion: 'mayor_mejor', disponible: true },
  { id: 'ratio_near_miss', categoria: 'Seguridad', label: 'Ratio Near Miss : Incidentes', unidad: ': 1', direccion: 'mayor_mejor', disponible: true },

  { id: 'ptw_cerrados_pct', categoria: 'Operacional', label: '% de PTW aprobados', unidad: '%', direccion: 'mayor_mejor', disponible: true },
  { id: 'inspecciones_vigentes_pct', categoria: 'Operacional', label: '% de inspecciones vigentes', unidad: '%', direccion: 'mayor_mejor', disponible: true },
  { id: 'ptw_tiempo_prom_dias', categoria: 'Operacional', label: 'Tiempo promedio apertura → aprobación PTW', unidad: 'días', direccion: 'menor_mejor', disponible: true },
  { id: 'iperc_vigente_pct', categoria: 'Operacional', label: '% de PTW con IPERC vigente (aprobada)', unidad: '%', direccion: 'mayor_mejor', disponible: false, motivoNoDisponible: 'La Matriz IPERC pasó a ser maestra/anual (no se vincula por PTW individual) — ya no hay "IPERC vigente" que medir por trabajo.' },

  { id: 'desechos_peligrosos_kg_mes', categoria: 'Ambiental', label: 'Desechos peligrosos generados (mes actual)', unidad: 'kg', direccion: 'menor_mejor', disponible: true },
  { id: 'reciclaje_pct', categoria: 'Ambiental', label: '% de reciclaje (peso en contenedor azul)', unidad: '%', direccion: 'mayor_mejor', disponible: true },
  { id: 'derrames_trimestre', categoria: 'Ambiental', label: 'Derrames en el trimestre actual', unidad: 'eventos', direccion: 'menor_mejor', disponible: true },
  { id: 'derrames_volumen_barriles_year', categoria: 'Ambiental', label: 'Volumen total derramado (año)', unidad: 'barriles', direccion: 'menor_mejor', disponible: true },

  { id: 'stop_per_capita', categoria: 'Cultura Preventiva', label: 'Tarjetas STOP per cápita', unidad: 'tarjetas/persona', direccion: 'mayor_mejor', disponible: true },
  { id: 'stop_participacion_pct', categoria: 'Cultura Preventiva', label: '% de participación en programa STOP', unidad: '%', direccion: 'mayor_mejor', disponible: false, motivoNoDisponible: 'Requiere nómina de personal — no existe módulo de personal en el sistema.' },
  { id: 'swa_eventos', categoria: 'Cultura Preventiva', label: 'Eventos de Stop Work Authority (indicador positivo)', unidad: 'eventos', direccion: 'mayor_mejor', disponible: true },
  { id: 'personal_capacitado_pct', categoria: 'Cultura Preventiva', label: '% de personal capacitado en procedimientos HSE', unidad: '%', direccion: 'mayor_mejor', disponible: false, motivoNoDisponible: 'Requiere módulo de capacitación — no existe en el sistema.' },
];

export type DashboardKpiValues = Record<string, number | null>;
export type DashboardMetas = Record<string, number>;

export type SemaforoColor = 'verde' | 'amarillo' | 'rojo';

export function kpiFueraDeMeta(valor: number, meta: number, direccion: KpiDireccion): boolean {
  return direccion === 'mayor_mejor' ? valor < meta : valor > meta;
}

/** HSE-MASTER-001: Verde = todo en meta; Amarillo = 1-2 fuera; Rojo = 3+ fuera o incumplimiento legal. */
export function evaluarSemaforo(indicadoresFueraDeMeta: number, incumplimientoLegal: boolean): SemaforoColor {
  if (incumplimientoLegal || indicadoresFueraDeMeta >= 3) return 'rojo';
  if (indicadoresFueraDeMeta >= 1) return 'amarillo';
  return 'verde';
}
