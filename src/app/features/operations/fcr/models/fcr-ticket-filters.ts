import {
  actividadesPendientes,
  ptwFirmadoOk,
  sinEventoCritico,
} from '../../shared/ticket-qhse.util';
import { FCR_PHASE_LABELS, type FcrPhase, type FcrTicket, type TipoOt } from './fcr.model';
import { FCR_TICKET_RELATION_LABELS, fcrTicketRelation, type FcrTicketRelation } from './fcr-flow';

export type FcrTiempoEnEtapa = 'menos_1d' | '1_3d' | 'mas_3d' | 'estancado';
export type FcrAlertaQhse = 'ptw_pendiente' | 'iperc_pendiente' | 'evento_critico';
export type FcrEstadoFiltro = 'activos' | 'cerrados' | 'todos';

export const FCR_TIEMPO_LABELS: Record<FcrTiempoEnEtapa, string> = {
  menos_1d: 'Menos de 1 día',
  '1_3d': '1 a 3 días',
  mas_3d: 'Más de 3 días',
  estancado: 'Estancados (+7 días)',
};

export const FCR_ALERTA_LABELS: Record<FcrAlertaQhse, string> = {
  ptw_pendiente: 'PTW pendiente de firma',
  iperc_pendiente: 'IPERC con actividades pendientes',
  evento_critico: 'Stop Work o emergencia abierta',
};

export const FCR_ESTADO_LABELS: Record<FcrEstadoFiltro, string> = {
  activos: 'Activos',
  cerrados: 'Cerrados',
  todos: 'Todos',
};

export const FCR_TIPO_OT_LABELS: Record<TipoOt, string> = { venta: 'Venta', servicio: 'Servicio' };

export interface FcrTicketFilters {
  /** Barra de búsqueda: código, pozo o cliente. */
  texto: string;
  /** Código de ticket o de pedido (PED-…), desde el panel de filtros. */
  codigo: string;
  tipos: TipoOt[];
  fases: FcrPhase[];
  clientes: string[];
  pozo: string;
  supervisores: string[];
  operadores: string[];
  unidades: string[];
  /** Fecha estimada, `yyyy-MM-dd` inclusive. */
  desde: string | null;
  hasta: string | null;
  tiempos: FcrTiempoEnEtapa[];
  relaciones: FcrTicketRelation[];
  alertas: FcrAlertaQhse[];
  estado: FcrEstadoFiltro;
}

export const FCR_EMPTY_FILTERS: FcrTicketFilters = {
  texto: '',
  codigo: '',
  tipos: [],
  fases: [],
  clientes: [],
  pozo: '',
  supervisores: [],
  operadores: [],
  unidades: [],
  desde: null,
  hasta: null,
  tiempos: [],
  relaciones: [],
  alertas: [],
  // 'todos' por defecto: la tabla conserva su filtro rápido "Cerrados" y el tablero muestra la columna Cierre completa.
  estado: 'todos',
};

const DIA_MS = 24 * 60 * 60 * 1000;

const includesText = (value: string | undefined, needle: string): boolean =>
  !needle || (value ?? '').toLowerCase().includes(needle.trim().toLowerCase());

/** Un criterio de lista vacío no filtra — cualquier valor pasa. */
const inList = <T>(list: readonly T[], value: T): boolean =>
  list.length === 0 || list.includes(value);

function matchesTiempo(t: FcrTicket, tiempos: readonly FcrTiempoEnEtapa[]): boolean {
  if (tiempos.length === 0) return true;
  const ms = t.timelineResumen?.tiempoEnFaseActualMs;
  if (ms === undefined) return false;
  return tiempos.some((bucket) => {
    switch (bucket) {
      case 'menos_1d':
        return ms < DIA_MS;
      case '1_3d':
        return ms >= DIA_MS && ms <= 3 * DIA_MS;
      case 'mas_3d':
        return ms > 3 * DIA_MS;
      case 'estancado':
        return ms > 7 * DIA_MS;
    }
  });
}

function matchesAlertas(t: FcrTicket, alertas: readonly FcrAlertaQhse[]): boolean {
  if (alertas.length === 0) return true;
  return alertas.some((alerta) => {
    switch (alerta) {
      case 'ptw_pendiente':
        return !ptwFirmadoOk(t.qhse);
      case 'iperc_pendiente':
        return actividadesPendientes(t.qhse).length > 0;
      case 'evento_critico':
        return !sinEventoCritico(t.qhse);
    }
  });
}

function matchesEstado(t: FcrTicket, estado: FcrEstadoFiltro): boolean {
  if (estado === 'todos') return true;
  return estado === 'cerrados' ? t.status === 'cerrado' : t.status !== 'cerrado';
}

function matchesFecha(t: FcrTicket, desde: string | null, hasta: string | null): boolean {
  const fecha = (t.estimatedDate ?? '').slice(0, 10);
  if (!fecha) return !desde && !hasta;
  return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
}

/** Criterios combinados con Y; dentro de un mismo criterio de lista, con O. */
export function applyFcrFilters(
  tickets: readonly FcrTicket[],
  f: FcrTicketFilters,
  roleName: string,
): FcrTicket[] {
  const texto = f.texto.trim().toLowerCase();
  return tickets.filter(
    (t) =>
      (!texto ||
        [t.code, t.wellName, t.clientName].some((v) => (v ?? '').toLowerCase().includes(texto))) &&
      (!f.codigo || includesText(t.code, f.codigo) || includesText(t.pedidoCode, f.codigo)) &&
      inList(f.tipos, t.tipoOt ?? 'venta') &&
      inList(f.fases, t.currentPhase) &&
      inList(f.clientes, t.clientName) &&
      includesText(t.wellName, f.pozo) &&
      inList(f.supervisores, t.assignedSupervisor) &&
      inList(f.operadores, t.assignedOperator) &&
      inList(f.unidades, t.unitCode) &&
      matchesFecha(t, f.desde, f.hasta) &&
      matchesTiempo(t, f.tiempos) &&
      inList(f.relaciones, fcrTicketRelation(t, roleName)) &&
      matchesAlertas(t, f.alertas) &&
      matchesEstado(t, f.estado),
  );
}

/** Un chip de "filtro activo" — `clear` lo quita dejando el resto igual. */
export interface FcrFilterChip {
  id: string;
  label: string;
  clear: (f: FcrTicketFilters) => FcrTicketFilters;
}

const joinLabels = <T extends string>(values: readonly T[], labels?: Record<T, string>): string =>
  values.map((v) => labels?.[v] ?? v).join(', ');

/** Chips de los criterios del panel (la barra de búsqueda se muestra aparte, en su propio campo). */
export function fcrActiveFilterChips(f: FcrTicketFilters): FcrFilterChip[] {
  const chips: FcrFilterChip[] = [];
  const add = (id: string, label: string, clear: (x: FcrTicketFilters) => FcrTicketFilters) =>
    chips.push({ id, label, clear });
  if (f.codigo) add('codigo', `Código: ${f.codigo}`, (x) => ({ ...x, codigo: '' }));
  if (f.tipos.length)
    add('tipos', `Tipo: ${joinLabels(f.tipos, FCR_TIPO_OT_LABELS)}`, (x) => ({ ...x, tipos: [] }));
  if (f.fases.length)
    add('fases', `Etapa: ${joinLabels(f.fases, FCR_PHASE_LABELS)}`, (x) => ({ ...x, fases: [] }));
  if (f.clientes.length)
    add('clientes', `Cliente: ${joinLabels(f.clientes)}`, (x) => ({ ...x, clientes: [] }));
  if (f.pozo) add('pozo', `Pozo: ${f.pozo}`, (x) => ({ ...x, pozo: '' }));
  if (f.supervisores.length)
    add('supervisores', `Supervisor: ${joinLabels(f.supervisores)}`, (x) => ({
      ...x,
      supervisores: [],
    }));
  if (f.operadores.length)
    add('operadores', `Operador: ${joinLabels(f.operadores)}`, (x) => ({ ...x, operadores: [] }));
  if (f.unidades.length)
    add('unidades', `Unidad: ${joinLabels(f.unidades)}`, (x) => ({ ...x, unidades: [] }));
  if (f.desde || f.hasta)
    add('fecha', `Fecha: ${f.desde ?? '…'} → ${f.hasta ?? '…'}`, (x) => ({
      ...x,
      desde: null,
      hasta: null,
    }));
  if (f.tiempos.length)
    add('tiempos', `En la etapa: ${joinLabels(f.tiempos, FCR_TIEMPO_LABELS)}`, (x) => ({
      ...x,
      tiempos: [],
    }));
  if (f.relaciones.length)
    add('relaciones', `Relación: ${joinLabels(f.relaciones, FCR_TICKET_RELATION_LABELS)}`, (x) => ({
      ...x,
      relaciones: [],
    }));
  if (f.alertas.length)
    add('alertas', `QHSE: ${joinLabels(f.alertas, FCR_ALERTA_LABELS)}`, (x) => ({
      ...x,
      alertas: [],
    }));
  if (f.estado !== FCR_EMPTY_FILTERS.estado)
    add('estado', `Estado: ${FCR_ESTADO_LABELS[f.estado]}`, (x) => ({
      ...x,
      estado: FCR_EMPTY_FILTERS.estado,
    }));
  return chips;
}

/** Valores posibles para los selectores del panel, sacados de los tickets cargados. */
export interface FcrFilterOptions {
  clientes: string[];
  supervisores: string[];
  operadores: string[];
  unidades: string[];
}

const distinctSorted = (values: readonly (string | undefined)[]): string[] =>
  [...new Set(values.filter((v): v is string => !!v?.trim()))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

export function fcrFilterOptions(tickets: readonly FcrTicket[]): FcrFilterOptions {
  return {
    clientes: distinctSorted(tickets.map((t) => t.clientName)),
    supervisores: distinctSorted(tickets.map((t) => t.assignedSupervisor)),
    operadores: distinctSorted(tickets.map((t) => t.assignedOperator)),
    unidades: distinctSorted(tickets.map((t) => t.unitCode)),
  };
}
