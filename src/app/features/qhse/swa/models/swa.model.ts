/**
 * HSE-SEGUIMIENTO-003 — Stop Work Authority (SWA). "Cualquier Trabajador"
 * activa el botón de pánico digital — igual que STOP, la activación no pasa
 * por el roleGuard de QHSE (ver header.ts, acceso "Reportar"); la gestión
 * del evento (cadena de notificación, cierre) sí queda para el staff HSE.
 *
 * Política de cero represalias: debe quedar visible en la UI de activación
 * y en el detalle del evento (RN de HSE-SEGUIMIENTO-003) — no es solo una
 * nota de este comentario, es un requisito de producto.
 */
export const SWA_ZERO_RETALIATION_NOTICE =
  'Política de cero represalias: nadie puede ser sancionado por detener un trabajo de buena fe, sin importar si al final se determina que era una falsa alarma.';

/** Cadena de notificación — un renglón por rol que debe enterarse del evento. */
export const SWA_NOTIFICATION_ROLES = ['Supervisor', 'Coordinador HSE', 'Gerente HSE'] as const;
export type SwaNotificationRole = (typeof SWA_NOTIFICATION_ROLES)[number];

export interface SwaNotification {
  rol: SwaNotificationRole;
  notificadoAt?: string;
}

export type SwaEstado = 'activo' | 'evaluado' | 'cerrado';

export const SWA_ESTADO_LABELS: Record<SwaEstado, string> = {
  activo: 'Trabajo detenido',
  evaluado: 'Riesgo evaluado',
  cerrado: 'Reanudado',
};

export interface SwaChecklistItem {
  label: string;
  checked: boolean;
}

export const DEFAULT_SWA_REANUDACION_CHECKLIST: SwaChecklistItem[] = [
  { label: 'Peligro identificado fue corregido o controlado', checked: false },
  { label: 'Personal involucrado fue informado de la solución', checked: false },
  { label: 'Supervisor confirma condiciones seguras para reanudar', checked: false },
];

export interface SwaEvento {
  id: number;
  code: string;
  estado: SwaEstado;

  activadoPorNombre: string;
  tipoPeligro: string;
  descripcion: string;
  ubicacion?: string;
  activadoAt: string;

  notificaciones: SwaNotification[];

  /** null mientras no se evalúa — Fase 2 del proceso. */
  riesgoReal: boolean | null;
  evaluacionNota?: string;
  evaluadoAt?: string;

  checklistReanudacion: SwaChecklistItem[];
  reanudadoAt?: string;

  /** Reconocimiento "Héroe de Seguridad" — se otorga al cerrar, a discreción del staff HSE. */
  heroeSeguridad: boolean;

  /** HSE-MASTER-001: si el riesgo no se controla, escala a Emergencia Mayor (HSE-TRIAGE-001). */
  emergenciaId?: number;

  /**
   * Servicio operativo detenido por este evento (HSE-SEGUIMIENTO-003 se
   * ejecuta "durante HSE-SITIO-001"). Mientras el evento siga abierto, el
   * ticket de Pumping/FCR no puede avanzar ningún paso.
   */
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
}

export type CreateSwaInput = Pick<
  SwaEvento,
  'activadoPorNombre' | 'tipoPeligro' | 'descripcion' | 'ubicacion' | 'ticketTipo' | 'ticketCode'
>;

export function swaNotificacionCompleta(e: Pick<SwaEvento, 'notificaciones'>): boolean {
  return e.notificaciones.every(n => !!n.notificadoAt);
}
