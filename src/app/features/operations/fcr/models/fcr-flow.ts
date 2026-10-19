import { FCR_PHASE_ROLE, type FcrPhase, type FcrTicket, type TipoOt } from './fcr.model';

/** Entrada VENTA — sin cambios respecto al flujo original. */
export const FCR_PHASE_KEYS_VENTA: readonly FcrPhase[] = [
  'revision_inicial',
  'preparacion_herramientas',
  'asignacion',
  'reunion_operativa',
  'ejecucion_operativa',
  'revision_reportes',
  'control_retorno',
  'cierre',
];

/**
 * Entrada SERVICIOS — paridad con VENTA: arranca en 'revision_inicial' (mismo
 * paso, mismo rol responsable) antes de 'preparacion_herramientas'
 * (Supervisor pide herramientas a Bodega), luego 'tipo_operador' asigna al
 * operador mecánico que repara e inspecciona por herramienta, y
 * 'aprobacion_supervisor_operaciones' confluye directo en
 * 'asignacion' (operador de campo) — ya no se vuelve a pasar por
 * 'preparacion_herramientas', eso ocurre una sola vez.
 */
export const FCR_PHASE_KEYS_SERVICIO: readonly FcrPhase[] = [
  'revision_inicial',
  'preparacion_herramientas',
  'tipo_operador',
  'inspeccion',
  'aprobacion_supervisor_operaciones',
  'asignacion',
  'reunion_operativa',
  'ejecucion_operativa',
  'revision_reportes',
  'control_retorno',
  'cierre',
];

/** Columnas del tablero: SERVICIO es el superconjunto de VENTA, en el mismo orden. */
export const FCR_BOARD_PHASES = FCR_PHASE_KEYS_SERVICIO;

export const FCR_SERVICE_ONLY_PHASES: ReadonlySet<FcrPhase> = new Set<FcrPhase>([
  'tipo_operador',
  'inspeccion',
  'aprobacion_supervisor_operaciones',
]);

/** Tickets sembrados antes de `tipoOt` no lo traen — mismo default que Pedido.tipoOt en el backend ('venta'). */
export function fcrPhaseKeys(tipoOt: TipoOt | undefined): readonly FcrPhase[] {
  return tipoOt === 'servicio' ? FCR_PHASE_KEYS_SERVICIO : FCR_PHASE_KEYS_VENTA;
}

/**
 * Rol al que le toca actuar sobre el ticket ahora mismo. En la mayoría de
 * fases hay un solo actor (FCR_PHASE_ROLE), pero dos fases alternan dentro
 * de sí mismas y el rol fijo mentiría:
 * - Revisión inicial con observaciones: el último autor dice de quién es el
 *   turno (Supervisor pidió corrección → Ingeniería de Ventas FCR; ya
 *   reenviada → vuelve al Supervisor).
 * - Preparación de herramientas (FCR-002): alterna Supervisor ↔ Bodega paso
 *   a paso, con un envío formal en cada sentido.
 *
 * Fuente única para la lista, el tablero y el banner del detalle — antes la
 * lista usaba solo el rol fijo y no coincidía con lo que decía el detalle.
 */
export function fcrResponsibleRole(t: FcrTicket): string {
  if (t.currentPhase === 'revision_inicial' && t.observations.length > 0) {
    const last = t.observations[t.observations.length - 1];
    return last.role === 'Supervisor' ? 'Ingeniería de Ventas FCR' : 'Supervisor';
  }
  if (t.currentPhase === 'preparacion_herramientas') {
    if (t.tools.some((tool) => tool.status === 'seleccionada' && !tool.sentToBodega))
      return 'Supervisor';
    if (t.tools.some((tool) => tool.status === 'seleccionada' && tool.sentToBodega))
      return 'Bodeguero';
    if (t.tools.some((tool) => tool.status === 'en_preparacion' && !tool.sentToSupervisor))
      return 'Bodeguero';
    if (
      t.tools.some(
        (tool) =>
          tool.status === 'en_preparacion' && tool.sentToSupervisor && !tool.recepcion?.marcado,
      )
    )
      return 'Supervisor';
  }
  return FCR_PHASE_ROLE[t.currentPhase].roleName;
}

/**
 * Roles que intervienen en una fase sin ser su responsable fijo en
 * FCR_PHASE_ROLE — los sub-pasos de `fcrResponsibleRole` y las firmas del
 * checklist de inspección (Revisado por Supervisor, Liberado por QHSE).
 */
const FCR_PHASE_SECONDARY_ROLES: Partial<Record<FcrPhase, readonly string[]>> = {
  revision_inicial: ['Ingeniería de Ventas FCR'],
  preparacion_herramientas: ['Bodeguero'],
  inspeccion: ['Supervisor', 'Técnico HSE', 'Coordinador HSE', 'Gerente HSE'],
};

/** Fases en las que `roleName` tiene que actuar en algún momento — "Mis etapas" en el tablero. */
export function fcrRolePhases(roleName: string): ReadonlySet<FcrPhase> {
  return new Set(
    FCR_BOARD_PHASES.filter(
      (phase) =>
        FCR_PHASE_ROLE[phase].roleName === roleName ||
        (FCR_PHASE_SECONDARY_ROLES[phase] ?? []).includes(roleName),
    ),
  );
}

/**
 * Relación del ticket con el rol actual:
 * - `turno`: le toca actuar ahora.
 * - `proxima`: el ticket todavía va a pasar por una etapa del rol (para planificar).
 * - `seguimiento`: ya no le toca nada (o el ticket está cerrado).
 */
export type FcrTicketRelation = 'turno' | 'proxima' | 'seguimiento';

export const FCR_TICKET_RELATION_LABELS: Record<FcrTicketRelation, string> = {
  turno: 'Mi turno',
  proxima: 'Llega a mi etapa',
  seguimiento: 'Seguimiento',
};

export function fcrTicketRelation(t: FcrTicket, roleName: string): FcrTicketRelation {
  if (t.status === 'cerrado') return 'seguimiento';
  if (fcrResponsibleRole(t) === roleName) return 'turno';
  const keys = fcrPhaseKeys(t.tipoOt);
  const mine = fcrRolePhases(roleName);
  const upcoming = keys.slice(keys.indexOf(t.currentPhase) + 1);
  return upcoming.some((phase) => mine.has(phase)) ? 'proxima' : 'seguimiento';
}

/** Tickets por columna y por página del tablero — todas las columnas avanzan juntas. */
export const FCR_BOARD_PAGE_SIZE = 4;

/** Etapas visibles en el tablero: todas, o solo las del rol ("Mis etapas"). */
export function fcrBoardPhases(roleName: string, soloMisEtapas: boolean): readonly FcrPhase[] {
  if (!soloMisEtapas) return FCR_BOARD_PHASES;
  const mine = fcrRolePhases(roleName);
  return FCR_BOARD_PHASES.filter((phase) => mine.has(phase));
}

/** Tickets de la etapa con más tickets — marca el total de páginas del tablero. */
export function fcrLongestColumn(
  tickets: readonly FcrTicket[],
  phases: readonly FcrPhase[],
): number {
  return Math.max(
    0,
    ...phases.map((phase) => tickets.filter((t) => t.currentPhase === phase).length),
  );
}
