/**
 * Stop Work Authority (SWA, HSE-SEGUIMIENTO-003) del contenedor `qhse` (`/api/v2/qhse/swa`). Cualquier trabajador la activa; el equipo HSE
 * notifica a la cadena (Supervisor, Técnico y Gerente HSE), evalúa (riesgo real o falsa alarma: bloqueada hasta notificar a todos),
 * confirma el checklist de reinicio y reanuda. **Una SWA sin cerrar bloquea el ticket** (decisión D10, confirmada por Dynadrill).
 */

export const PERMISO_SWA_VER = 'qhse.swa.ver';
export const PERMISO_SWA_GESTIONAR = 'qhse.swa.gestionar';
/** Activar una SWA es de cualquier trabajador (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';

/** Política de cero represalias: debe verse al activar y en el detalle (requisito de producto del formato). */
export const SWA_CERO_REPRESALIAS =
  'Política de cero represalias: nadie puede ser sancionado por detener un trabajo de buena fe, sin importar si al final se determina que era una falsa alarma.';

export type EstadoSwa = 'activo' | 'evaluado' | 'cerrado';

export const ESTADO_SWA_ETIQUETA: Record<EstadoSwa, string> = {
  activo: 'Trabajo detenido',
  evaluado: 'Riesgo evaluado',
  cerrado: 'Reanudado',
};

export const ESTADOS_SWA: EstadoSwa[] = ['activo', 'evaluado', 'cerrado'];

export interface TipoPeligro {
  id: string;
  codigo: string;
  nombre: string;
}

/** Servicio que se puede detener, para elegirlo al activar. */
export interface TicketDetenible {
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  cliente: string | null;
  pozo: string | null;
}

export interface SwaResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoSwa;
  tipoPeligro: string;
  descripcion: string;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  cliente: string | null;
  activadoPor: string;
  activadoAt: string;
  riesgoReal: boolean | null;
}

export interface NotificacionCadena {
  rolCadenaId: string;
  rolCodigo: string;
  rol: string;
  notificadoAt: string | null;
  notificadoPor: string | null;
}

export interface CriterioReinicio {
  criterioId: string;
  nombre: string;
  confirmadoAt: string | null;
  confirmadoPor: string | null;
}

export interface SwaDetalle {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoSwa;
  tipoPeligro: TipoPeligro;
  descripcion: string;
  ubicacion: string | null;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  activadoPor: string;
  activadoAt: string;
  cadena: NotificacionCadena[];
  notificacionCompleta: boolean;
  riesgoReal: boolean | null;
  evaluacionNota: string | null;
  evaluadoPor: string | null;
  evaluadoAt: string | null;
  criterios: CriterioReinicio[];
  reinicioCompleto: boolean;
  reanudadoPor: string | null;
  reanudadoAt: string | null;
  heroeSeguridad: boolean;
  /** Emergencia a la que escaló (HSE-MASTER-001); nulo mientras no escale. */
  emergencia: { id: string; codigo: string; estado: string } | null;
  /** Una SWA que no esté cerrada y aún no tenga emergencia puede escalar. */
  puedeEscalarAEmergencia: boolean;
  historial: {
    estadoAnterior: EstadoSwa | null;
    estadoNuevo: EstadoSwa;
    actor: string;
    at: string;
  }[];
}

export interface ActivarSwa {
  tipoPeligroId: string;
  descripcion: string;
  ubicacion?: string;
  ticketId?: string;
}

/** Roles de la cadena que aún no se notificaron. */
export function rolesSinNotificar(s: Pick<SwaDetalle, 'cadena'>): string[] {
  return s.cadena.filter((c) => !c.notificadoAt).map((c) => c.rol);
}

/** Criterios del checklist de reinicio que faltan. */
export function criteriosPendientes(s: Pick<SwaDetalle, 'criterios'>): string[] {
  return s.criterios.filter((c) => !c.confirmadoAt).map((c) => c.nombre);
}

/** Qué se puede hacer hoy con la SWA: notificar y evaluar (activa), confirmar y reanudar (evaluada) o nada (cerrada). */
export function siguientePaso(
  s: Pick<SwaDetalle, 'estado' | 'notificacionCompleta'>,
): 'notificar' | 'evaluar' | 'reiniciar' | null {
  if (s.estado === 'activo') return s.notificacionCompleta ? 'evaluar' : 'notificar';
  if (s.estado === 'evaluado') return 'reiniciar';
  return null;
}

/** Una SWA bloquea su ticket mientras no esté cerrada. */
export function bloqueaElTicket(s: Pick<SwaResumen, 'estado' | 'ticketId'>): boolean {
  return s.ticketId !== null && s.estado !== 'cerrado';
}
