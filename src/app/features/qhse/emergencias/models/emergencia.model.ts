/**
 * HSE-TRIAGE-001 — Plan de Respuesta a Emergencias y MEDEVAC. "Cualquier
 * Trabajador (Detector Inicial)" activa el botón de emergencia — igual que
 * STOP/SWA/Derrame, no pasa por el roleGuard de QHSE (ver "Reportar" en el
 * header); la gestión del evento (triage, MEDEVAC, notificación en cascada,
 * Reporte Flash) queda para el staff HSE.
 *
 * Puede activarse directo, o por escalamiento desde SWA (riesgo no
 * controlado) o desde un Derrame mayor (ver derrameActivaEmergenciaMayor en
 * derrame.model.ts) — origenSwaId/origenDerrameId conservan ese enlace.
 */

export type EmergenciaNivel = 1 | 2 | 3;

export const EMERGENCIA_NIVEL_LABELS: Record<EmergenciaNivel, string> = {
  1: 'Nivel 1 — Menor (controlable en sitio)',
  2: 'Nivel 2 — Moderada (requiere apoyo externo)',
  3: 'Nivel 3 — Mayor (amenaza vidas y operación)',
};

export type EmergenciaEstado = 'activa' | 'controlada' | 'cerrada';

export const EMERGENCIA_ESTADO_LABELS: Record<EmergenciaEstado, string> = {
  activa: 'Emergencia activa',
  controlada: 'Controlada',
  cerrada: 'Cerrada',
};

/** Cronómetro del evento — un renglón por acción, con timestamp automático. */
export interface EmergenciaTimelineEntry {
  timestamp: string;
  evento: string;
}

/**
 * Cadena de notificación en cascada (HSE-TRIAGE-001, minutos 5-15) — a
 * diferencia de SWA (3 roles notificados en paralelo), acá cada paso tiene
 * un origen y un destino distintos, con su propio plazo desde la
 * activación.
 */
export interface EmergenciaNotificacion {
  paso: number;
  desde: string;
  hacia: string;
  /** Minutos desde la activación dentro de los que debe completarse este paso. */
  plazoMinutos: number;
  notificadoAt?: string;
}

export const DEFAULT_EMERGENCIA_NOTIFICACIONES: Omit<EmergenciaNotificacion, 'notificadoAt'>[] = [
  { paso: 1, desde: 'Supervisor', hacia: 'Company Man', plazoMinutos: 2 },
  { paso: 2, desde: 'Company Man', hacia: 'Base HSE (Coordinador HSE)', plazoMinutos: 5 },
  { paso: 3, desde: 'Base HSE', hacia: 'Gerencia', plazoMinutos: 10 },
  { paso: 4, desde: 'Company Man', hacia: 'Base Operadora (Cliente)', plazoMinutos: 5 },
];

export function emergenciaNotificacionCompleta(e: Pick<EmergenciaEvento, 'notificaciones'>): boolean {
  return e.notificaciones.every(n => !!n.notificadoAt);
}

/** Conteo de personal — locación / evacuados / faltantes (minutos 1-5 del protocolo). */
export interface ConteoPersonal {
  totalEnLocacion: number;
  evacuados: number;
  completadoAt?: string;
}

export function conteoFaltantes(c: Pick<ConteoPersonal, 'totalEnLocacion' | 'evacuados'>): number {
  return Math.max(0, c.totalEnLocacion - c.evacuados);
}

/** Triage médico por color (HSE-TRIAGE-001). */
export type TriageColor = 'rojo' | 'amarillo' | 'verde' | 'negro';

export const TRIAGE_COLOR_LABELS: Record<TriageColor, string> = {
  rojo: 'Rojo — Inmediato (shock, hemorragia severa, inconsciente)',
  amarillo: 'Amarillo — Urgente (fracturas, quemaduras 2°)',
  verde: 'Verde — Menor (cortes, contusiones)',
  negro: 'Negro — Fallecido',
};

export interface SignosVitales {
  registradoAt: string;
  pulso?: number;
  presion?: string;
  respiracion?: number;
  consciencia?: string;
}

export type MedioTransporteMedevac = 'ambulancia' | 'lancha' | 'helicoptero';

export const MEDIO_TRANSPORTE_MEDEVAC_LABELS: Record<MedioTransporteMedevac, string> = {
  ambulancia: 'Ambulancia terrestre (1-3 h)',
  lancha: 'Lancha (zonas fluviales)',
  helicoptero: 'Helicóptero (30-60 min a Quito)',
};

export interface Herido {
  id: number;
  nombreCompleto: string;
  cedula?: string;
  triageColor: TriageColor;
  mecanismoLesion: string;
  lesiones: string;
  tratamientoCampo?: string;
  signosVitales: SignosVitales[];

  /** Criterios MEDEVAC: lesión que amenaza vida, requiere atención hospitalaria en < 2h, no tratable en campo. */
  medevacActivado: boolean;
  medioTransporte?: MedioTransporteMedevac;
  hospitalDestino?: string;
  etaMinutos?: number;
  hospitalNotificadoAt?: string;
  transferidoAt?: string;
}

/** Reporte Flash — plazo obligatorio de 2 horas desde la activación. */
export interface ReporteFlash {
  resumenEjecutivo: string;
  personalAfectado: string;
  accionesTomadas: string;
  estadoActual: string;
  proximosPasos: string;
  emitidoAt?: string;
}

export function reporteFlashVencido(e: Pick<EmergenciaEvento, 'activadoAt' | 'reporteFlash'>): boolean {
  if (e.reporteFlash.emitidoAt) return false;
  return Date.now() - new Date(e.activadoAt).getTime() > 2 * 60 * 60 * 1000;
}

export interface EmergenciaEvento {
  id: number;
  code: string;
  /** null hasta que el Comandante del Incidente / Base HSE lo declare (paso "Declarar Nivel de Emergencia"). */
  nivel: EmergenciaNivel | null;
  estado: EmergenciaEstado;
  tipo: string;
  ubicacion?: string;
  descripcion: string;
  activadoPorNombre: string;
  activadoAt: string;

  timeline: EmergenciaTimelineEntry[];
  conteoPersonal: ConteoPersonal;
  heridos: Herido[];
  notificaciones: EmergenciaNotificacion[];
  reporteFlash: ReporteFlash;

  controladaAt?: string;
  cerradaAt?: string;

  /** Escalamiento desde otro proceso (HSE-MASTER-001). */
  origenSwaId?: number;
  origenDerrameId?: number;

  /** Se llena al cerrar — HSE-TRIAGE-002 se activa automáticamente para Nivel 2/3. */
  investigacionId?: number;

  /** Servicio operativo durante el que ocurrió (HSE-TRIAGE-001 puede activarse "durante HSE-SITIO-001"). */
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
}

export type CreateEmergenciaInput = Pick<EmergenciaEvento, 'tipo' | 'descripcion' | 'ubicacion' | 'activadoPorNombre'> & {
  origenSwaId?: number;
  origenDerrameId?: number;
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
};

/**
 * HSE-MASTER-001: "Emergencia mayor controlada → Investigación (HSE-TRIAGE-002)".
 * Nivel 2/3 siempre generan investigación al cerrar; Nivel 1 queda a
 * criterio del staff (no es automático para emergencias menores).
 */
export function emergenciaRequiereInvestigacion(e: Pick<EmergenciaEvento, 'nivel'>): boolean {
  return e.nivel === 2 || e.nivel === 3;
}
