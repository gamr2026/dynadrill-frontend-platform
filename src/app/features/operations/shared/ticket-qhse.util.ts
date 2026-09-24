import { TicketQhseActividad, TicketQhseEmergencia, TicketQhseSwa, TicketQhseVinculo } from '../../../shared/models/ticket.model';

/**
 * Helpers compartidos por los detalles de ticket de Pumping y FCR. El único
 * gate QHSE real hoy es la firma en sitio del PTW (HSE-SITIO-001) —
 * `coberturaOk` queda por compatibilidad (siempre `true`, ver su comentario)
 * desde que se retiró el candado de cobertura de la Matriz Maestra IPERC.
 * Un ticket sin `qhse` (datos viejos / backend sin reiniciar) no se bloquea.
 */

/** Roles que pueden abrir el módulo QHSE y su endpoint. */
export const QHSE_VIEWER_ROLES = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE', 'Superadmin', 'Jefe de Base'];

export const IPERC_ESTADO_LABELS: Record<string, string> = {
  borrador: 'en elaboración por HSE',
  en_evaluacion: 'en evaluación por HSE',
  en_revision: 'en revisión por HSE',
  aprobada: 'aprobada',
  rechazada: 'rechazada',
  no_evaluada: 'sin evaluar',
};

export const PTW_FASE_LABELS: Record<string, string> = {
  gabinete: 'preparación en gabinete',
  ingreso: 'ingreso a locación',
  verificaciones: 'verificaciones de seguridad',
  formalizacion: 'formalización del recibimiento',
  ejecucion: 'ejecución y devolución',
  gestion_documental: 'gestión documental final',
};

export function ipercEstadoLabel(estado: string): string {
  return IPERC_ESTADO_LABELS[estado] ?? estado;
}

export function ptwFaseLabel(fase: string): string {
  return PTW_FASE_LABELS[fase] ?? fase;
}

/**
 * Antes bloqueaba el ticket hasta que la Matriz Maestra IPERC quedara con
 * cobertura aprobada — se retiró ese candado (Fase 1,
 * PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS.md): la matriz es maestra/anual, no
 * se aprueba por pedido, y el negocio confirmó que ya no debe bloquear el
 * flujo operativo — el único candado real que queda es el PTW
 * (`ptwFirmadoOk`). Queda como función (siempre `true`) en vez de borrar
 * cada call site, para no tener que tocar los ~10 lugares que la llaman.
 */
export function coberturaOk(_vinculo: TicketQhseVinculo | null | undefined): boolean {
  return true;
}

/** Actividades de la línea que HSE todavía no aprobó. */
export function actividadesPendientes(vinculo: TicketQhseVinculo | null | undefined): TicketQhseActividad[] {
  return (vinculo?.actividades ?? []).filter(a => a.estado !== 'aprobada');
}

export function actividadesPendientesTexto(vinculo: TicketQhseVinculo | null | undefined): string {
  return actividadesPendientes(vinculo)
    .map(a => a.nombre)
    .join(', ');
}

/**
 * `true` si el servicio puede pasar a ejecución en campo: el PTW —si ya se
 * abrió— está firmado en sitio (PUM-004 "Descargar documentos HSE",
 * RN-PUM-004-06 / RN-FCR-016). Único candado real hoy (Fase 1 del plan).
 *
 * Si todavía no hay PTW (`ptw == null`) NO se bloquea el paso: los tickets
 * sembrados o previos a la integración no tienen pedido vinculado y nunca
 * llegan a tener uno. El banner igual avisa que falta abrirlo. En un ticket
 * normal el PTW ya existe desde que se crea (nace junto con el ticket), así
 * que el bloqueo real aplica casi de inmediato.
 */
export function ptwFirmadoOk(vinculo: TicketQhseVinculo | null | undefined): boolean {
  const ptw = vinculo?.ptw;
  return !ptw || ptw.firmadoSitio;
}

/**
 * Evento Stop Work abierto contra el servicio (HSE-SEGUIMIENTO-003). El
 * backend sólo lo adjunta mientras no esté cerrado. Mientras exista, TODO
 * el trabajo del ticket está detenido — cualquier avance se bloquea hasta
 * que HSE + Company Man autoricen la reanudación.
 */
export function swaActivo(vinculo: TicketQhseVinculo | null | undefined): TicketQhseSwa | null {
  return vinculo?.swa ?? null;
}

export const SWA_ESTADO_LABELS: Record<string, string> = {
  activo: 'trabajo detenido',
  evaluado: 'riesgo evaluado — pendiente de reanudación',
  cerrado: 'reanudado',
};

/**
 * Emergencia abierta contra el servicio (HSE-TRIAGE-001). El backend sólo
 * la adjunta mientras no esté cerrada ('activa' y 'controlada' cuentan
 * como abierta). Mismo criterio que un SWA — detiene todo el trabajo —
 * pero con mayor severidad ("amenaza vidas y operación").
 */
export function emergenciaActiva(vinculo: TicketQhseVinculo | null | undefined): TicketQhseEmergencia | null {
  return vinculo?.emergencia ?? null;
}

export const EMERGENCIA_ESTADO_LABELS: Record<string, string> = {
  activa: 'emergencia activa',
  controlada: 'controlada — pendiente de cierre',
  cerrada: 'cerrada',
};

/** `true` si el ticket puede avanzar por el lado de eventos críticos (ni SWA ni emergencia abiertos). */
export function sinEventoCritico(vinculo: TicketQhseVinculo | null | undefined): boolean {
  return !swaActivo(vinculo) && !emergenciaActiva(vinculo);
}
