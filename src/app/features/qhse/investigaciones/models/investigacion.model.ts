/**
 * HSE-TRIAGE-002 — Investigación de Incidentes y Casi Accidentes (Near
 * Miss). Se activa automáticamente al cerrar una Emergencia Nivel 2/3
 * (ver emergenciaRequiereInvestigacion en emergencia.model.ts), o puede
 * abrirse directo por "daño material significativo" o "Near Miss con alto
 * potencial" sin haber pasado por una emergencia formal.
 */

export type IncidenteResultado =
  | 'fatal'
  | 'grave'
  | 'leve'
  | 'primeros_auxilios'
  | 'dano_material'
  | 'near_miss'
  | 'incidente_ambiental';

export const INCIDENTE_RESULTADO_LABELS: Record<IncidenteResultado, string> = {
  fatal: 'Fatal — muerte del trabajador',
  grave: 'Grave — incapacidad permanente, amputación, pérdida de sentido',
  leve: 'Leve — atención médica, días de reposo < 30',
  primeros_auxilios: 'Primeros auxilios — sin días perdidos',
  dano_material: 'Daño material — sin lesionados',
  near_miss: 'Cuasi accidente (Near Miss) — sin daño, pero pudo haberlo',
  incidente_ambiental: 'Incidente ambiental — derrame, emisión, contaminación',
};

export interface PlazosInvestigacion {
  inicioHoras: number;
  preliminarHoras: number | null;
  finalDias: number;
}

/**
 * HSE-TRIAGE-002 solo tabula plazos para Fatal/Grave/Leve/Near Miss.
 * Primeros Auxilios, Daño Material e Incidente Ambiental no tienen plazo
 * propio en el documento — se adopta el mismo plazo que "Leve" (el bucket
 * más cercano) hasta que QHSE confirme si corresponde uno distinto.
 */
export const PLAZOS_POR_RESULTADO: Record<IncidenteResultado, PlazosInvestigacion> = {
  fatal: { inicioHoras: 0, preliminarHoras: 24, finalDias: 15 },
  grave: { inicioHoras: 0, preliminarHoras: 48, finalDias: 30 },
  leve: { inicioHoras: 24, preliminarHoras: 72, finalDias: 45 },
  near_miss: { inicioHoras: 72, preliminarHoras: null, finalDias: 30 },
  primeros_auxilios: { inicioHoras: 24, preliminarHoras: 72, finalDias: 45 },
  dano_material: { inicioHoras: 24, preliminarHoras: 72, finalDias: 45 },
  incidente_ambiental: { inicioHoras: 24, preliminarHoras: 72, finalDias: 45 },
};

/**
 * Notificación legal obligatoria (Ministerio del Trabajo + IESS, plazo 24h)
 * — HSE-TRIAGE-002: "Aplica para accidentes con incapacidad temporal > 3
 * días, graves, fatales." No se rastrean días de incapacidad exactos en
 * este modelo, así que Fatal/Grave/Leve se tratan como candidatos y queda
 * a criterio del investigador confirmar si aplica.
 */
export function sugiereNotificacionLegal(resultado: IncidenteResultado): boolean {
  return resultado === 'fatal' || resultado === 'grave' || resultado === 'leve';
}

export interface NotificacionLegal {
  requerida: boolean;
  ministerioTrabajoNotificadoAt?: string;
  iessNotificadoAt?: string;
}

export interface PorQueEntry {
  pregunta: string;
  respuesta: string;
}

/** Mínimo 5 niveles respondidos — HSE-TRIAGE-002 no acepta menos. */
export function cincoPorquesCompleto(entries: PorQueEntry[]): boolean {
  return entries.filter(e => e.respuesta.trim().length > 0).length >= 5;
}

export const ISHIKAWA_CATEGORIAS = ['Mano de Obra', 'Método', 'Máquina', 'Material', 'Medioambiente', 'Medición'] as const;
export type IshikawaCategoria = (typeof ISHIKAWA_CATEGORIAS)[number];
export type IshikawaFactores = Record<IshikawaCategoria, string>;

export const DEFAULT_ISHIKAWA: IshikawaFactores = {
  'Mano de Obra': '',
  Método: '',
  Máquina: '',
  Material: '',
  Medioambiente: '',
  Medición: '',
};

export type AccionTipo = 'correctiva' | 'preventiva';

export const ACCION_TIPO_LABELS: Record<AccionTipo, string> = {
  correctiva: 'Correctiva — elimina la causa raíz específica',
  preventiva: 'Preventiva — evita que ocurra en otros contextos similares',
};

export type AccionEstado = 'pendiente' | 'implementada' | 'verificada';

export const ACCION_ESTADO_LABELS: Record<AccionEstado, string> = {
  pendiente: 'Pendiente',
  implementada: 'Implementada',
  verificada: 'Verificada',
};

export interface AccionCorrectiva {
  id: number;
  descripcion: string;
  tipo: AccionTipo;
  responsable: string;
  plazo: string;
  estado: AccionEstado;
}

export type InvestigacionEstado = 'abierta' | 'cerrada';

export interface Investigacion {
  id: number;
  code: string;
  estado: InvestigacionEstado;
  resultado: IncidenteResultado;
  descripcionEvento: string;
  fechaIncidente: string;
  ubicacion: string;

  /** Si se activó automáticamente al cerrar una Emergencia Nivel 2/3. */
  origenEmergenciaId?: number;

  escenaAseguradaAt?: string;
  liderInvestigacionNombre?: string;
  /** Multidisciplinario: HSE + Operaciones + Mantenimiento + Cliente — texto libre, igual que equipoEvaluador en IPERC. */
  equipoInvestigador: string[];

  evidenciasRecopiladas: string;
  testimoniosResumen: string;

  cincoPorques: PorQueEntry[];
  ishikawa: IshikawaFactores;
  causasRaiz: string;

  acciones: AccionCorrectiva[];

  notificacionLegal: NotificacionLegal;

  leccionesAprendidas: string;
  /** Matriz IPERC marcada para actualización al cerrar — HSE-MASTER-001, ciclo de mejora continua. */
  ipercActualizadoId?: number;

  informeAprobadoPorNombre?: string;
  informeAprobadoAt?: string;

  createdAt: string;
  cerradaAt?: string;
}

export type CreateInvestigacionInput = Pick<
  Investigacion,
  'resultado' | 'descripcionEvento' | 'fechaIncidente' | 'ubicacion' | 'origenEmergenciaId'
>;

export function plazoInicioVencido(inv: Pick<Investigacion, 'fechaIncidente' | 'resultado' | 'escenaAseguradaAt'>): boolean {
  if (inv.escenaAseguradaAt) return false;
  const plazoHoras = PLAZOS_POR_RESULTADO[inv.resultado].inicioHoras;
  return Date.now() - new Date(inv.fechaIncidente).getTime() > plazoHoras * 3_600_000;
}

export function plazoFinalVencido(inv: Pick<Investigacion, 'fechaIncidente' | 'resultado' | 'estado'>): boolean {
  if (inv.estado === 'cerrada') return false;
  const plazoDias = PLAZOS_POR_RESULTADO[inv.resultado].finalDias;
  return Date.now() - new Date(inv.fechaIncidente).getTime() > plazoDias * 24 * 3_600_000;
}

export function accionesPendientes(acciones: AccionCorrectiva[]): number {
  return acciones.filter(a => a.estado !== 'verificada').length;
}
