/**
 * Fases de HSE-PLAN-001: Preparación → Identificación/Evaluación inicial →
 * Controles/Reevaluación → Documentación y aprobación. "borrador" cubre la
 * Fase 1 (desglose de actividad en tareas); los peligros se pueden
 * identificar desde ahí mismo, a la par de cada tarea — solo la
 * evaluación de riesgo (probabilidad x severidad) y los controles quedan
 * para cuando la matriz pasa a "en_evaluacion".
 */
export type IpercStatus = 'borrador' | 'en_evaluacion' | 'en_revision' | 'aprobada' | 'rechazada';

export const IPERC_STATUS_LABELS: Record<IpercStatus, string> = {
  borrador: 'Borrador',
  en_evaluacion: 'En evaluación',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

/**
 * Jerarquía de controles GTC 45 completa (5 niveles) — antes solo 3
 * (ingeniería/administrativo/EPP), confirmado insuficiente al leer el
 * Excel real DYN-SGI-RE-087 (columnas "Eliminación/Sustitución/Control de
 * ingeniería/Señalización.../EPI o colectivo").
 */
export type ControlType = 'eliminacion' | 'sustitucion' | 'ingenieria' | 'administrativo' | 'epp';

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  eliminacion: 'Eliminación',
  sustitucion: 'Sustitución',
  ingenieria: 'Control de ingeniería',
  administrativo: 'Señalización, advertencias, controles administrativos',
  epp: 'Equipos / elementos de protección personal',
};

export interface IpercControl {
  id: number;
  type: ControlType;
  description: string;
}

/**
 * GTC 45 real (confirmado leyendo DYN-SGI-RE-087) — reemplaza la matriz
 * simple Probabilidad x Severidad (1-5 cada eje) que se usaba antes.
 * Nivel de Deficiencia (ND) x Nivel de Exposición (NE) = Nivel de
 * Probabilidad (NP); NP x Nivel de Consecuencia (NC) = Nivel de Riesgo
 * (NR). Los 4 valores posibles de cada eje (0/2/6/10 para ND; 1/2/3/4
 * para NE; 10/25/60/100 para NC) y las bandas de interpretación de NP/NR
 * son los oficiales de la norma, confirmados contra las tablas del propio
 * Excel — no son un ajuste propio de Dynadrill.
 */
export type NivelDeficiencia = 0 | 2 | 6 | 10;
export type NivelExposicion = 1 | 2 | 3 | 4;
export type NivelConsecuencia = 10 | 25 | 60 | 100;

export interface GtcOpcion<T extends number> {
  valor: T;
  label: string;
  descripcion: string;
}

export const ND_OPCIONES: GtcOpcion<NivelDeficiencia>[] = [
  { valor: 10, label: 'Muy Alto', descripcion: 'Se ha(n) detectado peligro(s) que determina(n) como posible la generación de incidentes o consecuencias muy significativas, o la eficacia del conjunto de medidas preventivas existentes respecto al riesgo es nula o no existe, o ambos.' },
  { valor: 6, label: 'Alto', descripcion: 'Se ha(n) detectado algún(os) peligro(s) que pueden dar lugar a consecuencias significativa(s), o la eficacia del conjunto de medidas preventivas existentes es baja, o ambos.' },
  { valor: 2, label: 'Medio', descripcion: 'Se han detectado peligros que pueden dar lugar a consecuencias poco significativa(s) o de menor importancia, o la eficacia del conjunto de medidas preventivas existentes es moderada, o ambos.' },
  { valor: 0, label: 'Bajo — riesgo controlado', descripcion: 'No se ha detectado consecuencia alguna, o la eficacia del conjunto de medidas preventivas existentes es alta, o ambos. El riesgo está controlado.' },
];

export const NE_OPCIONES: GtcOpcion<NivelExposicion>[] = [
  { valor: 4, label: 'Continua', descripcion: 'La situación de exposición se presenta sin interrupción o varias veces con tiempo prolongado durante la jornada laboral.' },
  { valor: 3, label: 'Frecuente', descripcion: 'La situación de exposición se presenta varias veces durante la jornada laboral por tiempos cortos.' },
  { valor: 2, label: 'Ocasional', descripcion: 'La situación de exposición se presenta alguna vez durante la jornada laboral y por un periodo de tiempo corto.' },
  { valor: 1, label: 'Esporádica', descripcion: 'La situación de exposición se presenta de manera eventual.' },
];

export const NC_OPCIONES: GtcOpcion<NivelConsecuencia>[] = [
  { valor: 100, label: 'Mortal / Catastrófico', descripcion: 'Muerte(s).' },
  { valor: 60, label: 'Muy Grave', descripcion: 'Lesiones o enfermedades graves irreparables (incapacidad permanente parcial o invalidez).' },
  { valor: 25, label: 'Grave', descripcion: 'Lesiones o enfermedades con incapacidad laboral temporal (ILT).' },
  { valor: 10, label: 'Leve', descripcion: 'Lesiones o enfermedades que no requieren incapacidad.' },
];

export type NivelProbabilidad = 'bajo' | 'medio' | 'alto' | 'muy_alto';

/** NP = ND x NE — bandas oficiales GTC 45. */
export function calcularNP(nd: NivelDeficiencia | null, ne: NivelExposicion | null): number | null {
  return nd != null && ne != null ? nd * ne : null;
}

export function interpretarNP(np: number): { nivel: NivelProbabilidad; label: string } {
  if (np >= 24) return { nivel: 'muy_alto', label: 'Muy Alto (24-40)' };
  if (np >= 10) return { nivel: 'alto', label: 'Alto (10-20)' };
  if (np >= 6) return { nivel: 'medio', label: 'Medio (6-8)' };
  return { nivel: 'bajo', label: 'Bajo (2-4)' };
}

export type NivelRiesgo = 'I' | 'II' | 'III' | 'IV';

/** NR = NP x NC — 4 bandas oficiales GTC 45 (I más grave, IV más leve). */
export function calcularNR(nd: NivelDeficiencia | null, ne: NivelExposicion | null, nc: NivelConsecuencia | null): number | null {
  const np = calcularNP(nd, ne);
  return np != null && nc != null ? np * nc : null;
}

export function interpretarNR(nr: number): { nivel: NivelRiesgo; label: string; aceptabilidad: string } {
  if (nr >= 600) return { nivel: 'I', label: 'I (600-4000)', aceptabilidad: 'No aceptable' };
  if (nr >= 150) return { nivel: 'II', label: 'II (150-599)', aceptabilidad: 'No aceptable o aceptable con control específico' };
  if (nr >= 40) return { nivel: 'III', label: 'III (40-149)', aceptabilidad: 'Mejorable' };
  return { nivel: 'IV', label: 'IV (menos de 40)', aceptabilidad: 'Aceptable' };
}

/** Evaluación GTC 45 de un peligro en un momento dado (inicial o residual) — los 3 ejes, sin marcar hasta que se evalúan. */
export interface GtcEvaluacion {
  nd: NivelDeficiencia | null;
  ne: NivelExposicion | null;
  nc: NivelConsecuencia | null;
}

export const GTC_EVALUACION_VACIA: GtcEvaluacion = { nd: null, ne: null, nc: null };

export interface IpercHazard {
  id: number;
  /** Peligro identificado. */
  peligro: string;
  /** Clasificación del peligro — Físico/Químico/Biológico/Ergonómico/Psicosocial/Condiciones de seguridad/Fenómenos naturales (columna "Clasificación" del Excel real). */
  clasificacionPeligro?: string;
  /** Fuente/origen del riesgo. */
  fuenteRiesgo: string;
  /** Controles que ya existían antes de esta evaluación — "Fuente" del Excel real (texto libre, Fase 1-2). */
  controlesExistentes: string;
  /** Controles existentes a nivel del medio de propagación (columna "Medio" del Excel real). */
  controlesExistentesMedio?: string;
  /** Controles existentes a nivel del individuo expuesto (columna "Individuo" del Excel real). */
  controlesExistentesIndividuo?: string;
  /** Dónde se genera el riesgo respecto al trabajador — ej. "Sitio de trabajo" (columna "Generado en" del Excel real). */
  generadoEn?: string;
  /** Efectos posibles del peligro en texto libre (columna del Excel real, distinta de "Peor consecuencia"). */
  efectosPosibles?: string;
  /** N° de personas expuestas (columna del Excel real). */
  numeroExpuestos?: number;
  /** Peor consecuencia posible en texto libre (columna del Excel real, distinta de la banda NC). */
  peorConsecuencia?: string;
  /** ¿Existe requisito legal específico asociado? (columna del Excel real). */
  requisitoLegal?: boolean;
  /** Seguimiento — columna "SEGUIMIENTO" del Excel real (aparece dos veces en el archivo, misma info en ambas). */
  seguimiento?: string;
  /** Riesgo inicial — Fase 2, sin los controles nuevos definidos en Fase 3. */
  riesgoInicial: GtcEvaluacion;
  /** Controles nuevos definidos en Fase 3, jerarquía completa de 5 niveles. */
  controles: IpercControl[];
  /** Riesgo residual — Fase 3, con los controles de arriba ya aplicados. */
  riesgoResidual: GtcEvaluacion;
}

export interface IpercTask {
  id: number;
  /** Tarea dentro del desglose de la actividad (Fase 1). */
  descripcion: string;
  /** ¿Es rutinaria? (columna "Rutinaria (Si ó Nó)" del Excel real). */
  rutinaria?: boolean;
  /** Área o puesto de trabajo donde se realiza la tarea (columna del Excel real). */
  areaPuestoTrabajo?: string;
  /** Cargos expuestos a los peligros de esta tarea (columna del Excel real). */
  cargosExpuestos?: string;
  hazards: IpercHazard[];
}

/** DYN-SGI-RE-087 — único formato de HSE-PLAN-001 generado nativamente por el sistema (ver tabla de formatos del proceso). */
export interface IpercMatrix {
  id: number;
  code: string;
  status: IpercStatus;
  actividad: string;
  /**
   * "Zona/Lugar" del Excel real — la base (ej. "Base Coca"), no el pozo
   * puntual. Queda fija desde que se crea la matriz de esta actividad (no
   * cambia en usos posteriores) — verificado contra DYN-SGI-RE-087 real:
   * el mismo criterio ya rige ahí (una sola matriz por actividad).
   */
  ubicacion: string;
  /**
   * "PROCESO" del Excel real — el área que gestiona el riesgo (Operaciones,
   * Mantenimiento, Ingeniería y Ventas, Laboratorio, Administrativo, …).
   * Para matrices que nacen de un ticket de Pumping/FCR siempre es
   * "Operaciones" (así aparece en el archivo real, sin distinguir FCR de
   * Pumping). Opcional: matrices sembradas antes de este campo no lo
   * tienen.
   */
  proceso?: string;
  /** Nombres del equipo evaluador multidisciplinario (Fase 1). Texto libre por ahora — no requiere que cada integrante tenga usuario en el sistema. */
  equipoEvaluador: string[];
  tasks: IpercTask[];
  /**
   * Fase 4: "Elaborar procedimiento [operativo] y ATS base" — el diagrama
   * de HSE-PLAN-001 pone este paso ANTES de "¿Aprobado?", así que ambos
   * documentos se adjuntan directamente acá, previo a enviar la matriz a
   * revisión — no dependen de ningún otro proceso (en particular, no del
   * PTW: ese ni siquiera puede existir todavía, porque solo se abre a
   * partir de una matriz ya aprobada). Ninguno de los dos tiene código
   * DYN-SGI-RE-xxx propio ni aparece en la tabla de formatos del proceso.
   */
  atsAdjunto?: string;
  atsAdjuntadoAt?: string;
  procedimientoAdjunto?: string;
  procedimientoAdjuntadoAt?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Fase 4 — aprobación. "De momento una línea": usuario + fecha, sin
   * captura de firma manuscrita (ver decisiones del plan de desarrollo).
   */
  approvedByName?: string;
  approvedAt?: string;
  /**
   * Al rechazar, la matriz queda en "rechazada" (en vez de saltar
   * directo a "en_evaluacion") para que quien la levantó vea con claridad
   * que hubo un rechazo y por qué, antes de retomarla — ver
   * IpercDetailPage.resumeEvaluation().
   */
  rejectedByName?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  /**
   * HSE-MASTER-001 — ciclo de mejora continua: al cerrar una Investigación
   * (HSE-TRIAGE-002) que involucra esta actividad, se marca la matriz para
   * revisión con la lección aprendida ya redactada, en vez de solo un
   * banner informativo. El responsable de HSE-PLAN-001 la revisa, actualiza
   * controles si aplica y limpia el flag.
   */
  leccionAprendidaPendiente?: boolean;
  leccionAprendidaTexto?: string;
  leccionAprendidaInvestigacionCode?: string;

  /**
   * Puente Operaciones → HSE-PLAN-001: cuando esta matriz se creó como
   * "solicitud" a partir de un ticket de Pumping/FCR, guarda de dónde vino
   * — la bandeja de HSE muestra "solicitada desde <ticket>".
   */
  origenOperativo?: { tipo: 'pumping' | 'fcr'; ticketCode: string; pedidoCode?: string };
}

/** Fase 1 de HSE-PLAN-001 — lo mínimo para arrancar una matriz nueva en estado "borrador"; tasks/hazards se agregan después, dentro del detalle. */
export type CreateIpercMatrixInput = Pick<IpercMatrix, 'actividad' | 'ubicacion' | 'proceso' | 'equipoEvaluador'>;

/**
 * Categorías reales de PROCESO, tomadas del archivo DYN-SGI-RE-087 original
 * (325 filas de datos, columna A), normalizadas (mayúsculas/puntuación
 * inconsistentes en el archivo real unificadas a una sola forma por
 * categoría). El selector de creación manual permite agregar otras.
 */
export const IPERC_PROCESO_SUGERIDOS: string[] = [
  'Operaciones',
  'Laboratorio',
  'Mantenimiento',
  'Dirección General',
  'Ingeniería y Ventas',
  'Compras y Logística',
  'Administrativo Financiero',
  'Administrativo',
  'Gestión Integral',
  'Talento Humano',
];

/** Zonas/bases reales del archivo original (columna "Zona/Lugar"), normalizadas. El selector de creación manual permite agregar otras. */
export const IPERC_ZONA_SUGERIDAS: string[] = ['Base Coca', 'Base Quito', 'Base Coca - Quito', 'Base Coca - Campo', 'Base Quito - Coca - Campo'];
