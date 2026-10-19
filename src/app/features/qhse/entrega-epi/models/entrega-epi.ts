/**
 * Entrega de EPI y ropa de trabajo (DYN-SGI-RE-032) del contenedor `qhse` (`/api/v2/qhse/epi`). A diferencia de la demo, el trabajador
 * es una cuenta (su cédula y cargo salen de su perfil) y los elementos salen de un catálogo. Ciclo: solicitado → aprobado →
 * despachado (o rechazado). QHSE abre una solicitud por cada operador cuando Pumping asigna el servicio.
 */

export const PERMISO_EPI_VER = 'qhse.epi.ver';
export const PERMISO_EPI_CREAR = 'qhse.epi.crear';
/** El equipo de Pumping pide el EPI de los operadores de su ticket y ve el estado de cada solicitud. */
export const PERMISO_EPI_SOLICITAR = 'qhse.epi.solicitar';
export const PERMISO_EPI_APROBAR = 'qhse.epi.aprobar';
export const PERMISO_EPI_DESPACHAR = 'qhse.epi.despachar';

export type EstadoEpi = 'solicitado' | 'aprobado' | 'despachado' | 'rechazado';

export const ESTADO_EPI_ETIQUETA: Record<EstadoEpi, string> = {
  solicitado: 'Solicitado',
  aprobado: 'Aprobado',
  despachado: 'Despachado',
  rechazado: 'Rechazado',
};

export interface TrabajadorEpi {
  id: string;
  nombre: string;
  cedula: string | null;
  cargo: string | null;
}

export interface TicketEpi {
  id: string;
  numero: number | null;
  pedidoId: string;
  pedidoCodigo: string;
}

/** Base o bodega del catálogo donde se entrega el EPI. */
export interface LugarEpi {
  id: string;
  nombre: string;
}

export type TipoTalla = 'ropa' | 'calzado' | 'guante';

export interface TallaEpi {
  id: string;
  tipo: TipoTalla;
  codigo: string;
}

export interface EntregaEpiResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoEpi;
  lugar: LugarEpi | null;
  trabajador: TrabajadorEpi;
  ticket: TicketEpi | null;
  renglones: number;
  firmadaPorTrabajador: boolean;
  firmadaPorTalentoHumano: boolean;
  createdAt: string;
}

export interface RenglonEpi {
  id: string;
  elementoId: string;
  elemento: string;
  cantidad: number;
  tallaId: string | null;
  /** Código de la talla del catálogo (M, 42, 9...). */
  talla: string | null;
  recibioCapacitacion: boolean;
  observaciones: string | null;
  /** AAAA-MM-DD */
  entregadoEl: string;
}

export interface FirmaEpi {
  usuarioId: string;
  nombre: string;
  at: string;
}

export interface EntregaEpi extends Omit<
  EntregaEpiResumen,
  'renglones' | 'firmadaPorTrabajador' | 'firmadaPorTalentoHumano'
> {
  renglones: RenglonEpi[];
  firmaTrabajador: FirmaEpi | null;
  firmaTalentoHumano: FirmaEpi | null;
  aprobado: FirmaEpi | null;
  rechazado: (FirmaEpi & { motivo: string | null }) | null;
  despachado: FirmaEpi | null;
  historial: Array<{
    estadoAnterior: EstadoEpi | null;
    estadoNuevo: EstadoEpi;
    motivo: string | null;
    actor: string | null;
    at: string;
  }>;
  updatedAt: string;
}

export interface ElementoEpi {
  id: string;
  nombre: string;
  codigo: string;
  /** Tipo de talla que lleva; `null` = no lleva talla. */
  tipoTalla: TipoTalla | null;
}

/** Lo que se envía por cada elemento entregado. */
export interface RenglonEntrada {
  elementoId: string;
  cantidad: number;
  tallaId?: string;
  recibioCapacitacion: boolean;
  observaciones?: string;
}

export interface FiltroEntregasEpi {
  estado?: EstadoEpi;
  q?: string;
}

/** Los renglones se pueden cambiar hasta que se despacha. */
export const esEditable = (e: Pick<EntregaEpi, 'estado'>): boolean =>
  e.estado === 'solicitado' || e.estado === 'aprobado';

/** Lo que falta para poder despachar, en palabras de quien opera (vacío = listo). */
export function pendientesDeDespacho(
  e: Pick<EntregaEpi, 'estado' | 'lugar' | 'renglones' | 'firmaTrabajador'>,
): string[] {
  if (e.estado !== 'aprobado') return [];
  const falta: string[] = [];
  if (!e.lugar) falta.push('indicar el lugar de la entrega');
  if (e.renglones.length === 0) falta.push('registrar al menos un elemento entregado');
  if (!e.firmaTrabajador) falta.push('registrar la declaración del trabajador');
  return falta;
}

export function sinCapacitacion(e: Pick<EntregaEpi, 'renglones'>): RenglonEpi[] {
  return e.renglones.filter((r) => !r.recibioCapacitacion);
}

/** Texto del servidor (`detail`/`message`) o el de respaldo; los 409 indican que alguien más cambió la entrega. */
export function mensajeErrorEpi(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  const texto = Array.isArray(m)
    ? m.filter((x) => typeof x === 'string').join('. ')
    : typeof m === 'string'
      ? m
      : '';
  if (e?.status === 403) return texto || 'Su rol no tiene permiso para esta acción.';
  if (e?.status === 409) return texto || 'La entrega cambió. Recargue e intente de nuevo.';
  return texto || porDefecto;
}

/** Un operador asignado a un ticket y su solicitud de EPI más reciente (`null` = todavía no se solicitó). */
export interface OperadorEpiTicket {
  usuarioId: string;
  nombre: string;
  cargo: string | null;
  entrega: {
    id: string;
    numero: number;
    codigo: string;
    estado: EstadoEpi;
    motivoRechazo: string | null;
  } | null;
}
