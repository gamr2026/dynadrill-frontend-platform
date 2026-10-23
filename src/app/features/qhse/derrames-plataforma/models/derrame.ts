/**
 * Derrames (HSE-AMBIENTAL-002) del contenedor `qhse` (`/api/v2/qhse/derrames`). Cualquier trabajador activa la alerta; el equipo HSE contiene
 * en los primeros 5 minutos, confirma el volumen real, notifica al MAE cuando es obligatorio, cierra y, si el derrame fue en suelo, genera su
 * desecho peligroso. La autoridad de las reglas es el backend (y la base de datos); aquí solo se muestran y se guían.
 *
 * Los umbrales de las bandas de volumen son un supuesto de la demo y están «por confirmar con Dynadrill».
 */

export const PERMISO_DERRAMES_VER = 'qhse.derrames.ver';
export const PERMISO_DERRAMES_GESTIONAR = 'qhse.derrames.gestionar';
/** Configurar las bandas de volumen (Gerente HSE y administradores). */
export const PERMISO_DERRAMES_CONFIGURAR = 'qhse.derrames.configurar';
/** Activar la alerta de derrame es de cualquier trabajador (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';

/** La contención empieza en los primeros 5 minutos desde la alerta (se informa; no bloquea). */
export const PLAZO_CONTENCION_MINUTOS = 5;

export type EstadoDerrame = 'activo' | 'contenido' | 'cerrado';

export const ESTADOS_DERRAME: EstadoDerrame[] = ['activo', 'contenido', 'cerrado'];

export const ESTADO_DERRAME_ETIQUETA: Record<EstadoDerrame, string> = {
  activo: 'Derrame activo',
  contenido: 'Contenido',
  cerrado: 'Cerrado',
};

export const AVISO_ALERTA_DERRAME =
  'Priorice su seguridad: use EPP antes de intervenir. La contención debe iniciar en los primeros 5 minutos.';

export interface UbicacionDerrame {
  id: string;
  codigo: string;
  nombre: string;
}

/** Banda de volumen en barriles [desde, hasta). `hastaBarriles` vacío = sin tope. */
export interface BandaVolumen {
  id: string;
  codigo: string;
  nombre: string;
  desdeBarriles: number;
  hastaBarriles: number | null;
  /** Verdadero mientras Dynadrill no confirme el umbral. */
  porConfirmar: boolean;
}

export interface BandaConfigurable extends BandaVolumen {
  orden: number;
  exigeNotificacionMae: boolean;
  escalaAEmergencia: boolean;
  activo: boolean;
}

export interface ServicioDerrame {
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  cliente: string | null;
  pozo: string | null;
}

export interface CatalogosDerrame {
  ubicaciones: UbicacionDerrame[];
  bandas: BandaVolumen[];
  tickets: ServicioDerrame[];
}

export interface ActivarDerrame {
  ubicacionId: string;
  bandaId: string;
  descripcion: string;
  ubicacionFisica?: string;
  ticketId?: string;
}

export interface DerrameActivado {
  id: string;
  codigo: string;
  estado: EstadoDerrame;
  requiereNotificacionMae: boolean;
}

export interface DerrameResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoDerrame;
  descripcion: string;
  ubicacion: { codigo: string; nombre: string };
  banda: { codigo: string; nombre: string };
  volumenRealBarriles: number | null;
  /** La notificación al MAE ya se registró. */
  notificadoMae: boolean;
  requiereNotificacionMae: boolean;
  escalaAEmergencia: boolean;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  activadoAt: string;
}

export interface PasoContencion {
  itemId: string;
  codigo: string;
  nombre: string;
  confirmadoAt: string | null;
  confirmadoPor: string | null;
}

export interface NotificacionMae {
  at: string;
  por: string | null;
  referencia: string | null;
}

export interface DerrameDetalle {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoDerrame;
  descripcion: string;
  ubicacionFisica: string | null;
  ubicacion: { codigo: string; nombre: string };
  banda: { codigo: string; nombre: string; porConfirmar: boolean };
  bandaReal: { codigo: string; nombre: string } | null;
  requiereNotificacionMae: boolean;
  escalaAEmergencia: boolean;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  activadoPor: string | null;
  activadoAt: string;
  checklist: PasoContencion[];
  checklistCompleto: boolean;
  contenidoAt: string | null;
  contenidoPor: string | null;
  contencionMinutos: number | null;
  contencionEnPlazo: boolean | null;
  volumenRealBarriles: number | null;
  volumenConfirmadoPor: string | null;
  volumenConfirmadoAt: string | null;
  notificacionMae: NotificacionMae | null;
  maePendiente: boolean;
  puedeCerrar: boolean;
  desecho: { id: string; codigo: string } | null;
  puedeGenerarDesecho: boolean;
  emergencia: { id: string; codigo: string; estado: string } | null;
  puedeEscalarAEmergencia: boolean;
  cerradoAt: string | null;
  cerradoPor: string | null;
  volumenes: Array<{ barriles: number; actor: string | null; at: string }>;
  historial: Array<{ estado: EstadoDerrame; actor: string | null; at: string }>;
}

export interface TableroDerrames {
  anio: number;
  total: number;
  porEstado: Record<EstadoDerrame, number>;
  maePendientes: number;
  contenidos: number;
  contenidosEnPlazo: number;
  plazoContencionMinutos: number;
  /** Suma del volumen real confirmado de los derrames del año (KPI «volumen total derramado»). */
  volumenRealBarriles: number;
  /** Contenidos o cerrados cuyo volumen real aún no se confirma (no suman al KPI). */
  sinVolumenConfirmado: number;
}

export interface ActualizarBanda {
  nombre?: string;
  desdeBarriles?: number;
  hastaBarriles?: number | null;
  exigeNotificacionMae?: boolean;
  escalaAEmergencia?: boolean;
  porConfirmar?: boolean;
  activo?: boolean;
}

export interface LineaDesechoDerrame {
  descripcion: string;
  codigo: string;
  cantidadGalones: number;
  numeroLote?: string;
  bultos?: number;
}

export interface GenerarDesechoDerrame {
  contenedorId: string;
  caracteristicaIds: string[];
  items: LineaDesechoDerrame[];
  nota?: string;
}

/** Catálogos de Desechos que necesita el formulario del desecho generado (`GET /v2/qhse/desechos/catalogos`). */
export interface CatalogosDesechoDerrame {
  caracteristicas: Array<{ id: string; codigo: string; nombre: string }>;
  contenedores: Array<{ id: string; codigo: string; nombre: string; uso: string }>;
}

/**
 * Lo que la pantalla de Emergencias necesita para escalar desde un derrame. Lo conecta quien ensambla las rutas (el diálogo de Emergencias es
 * de otro módulo): devuelve la respuesta del diálogo, `true` si se activó la emergencia.
 */
export interface EscalarDerrameContexto {
  derrameId: string;
  codigo: string;
  descripcion: string;
  ubicacionFisica: string | null;
  ticketId: string | null;
}

/** Volumen en barriles, con un decimal cuando hace falta («2,5 bbl»). */
export function formatoBarriles(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return 'Sin confirmar';
  return `${Number.isInteger(valor) ? valor : valor.toLocaleString('es-EC', { maximumFractionDigits: 3 })} bbl`;
}

/** Rango legible de una banda («1 a 5 bbl», «5 bbl o más»). */
export function rangoDeBanda(b: Pick<BandaVolumen, 'desdeBarriles' | 'hastaBarriles'>): string {
  return b.hastaBarriles === null
    ? `${b.desdeBarriles} bbl o más`
    : `${b.desdeBarriles} a ${b.hastaBarriles} bbl`;
}

/** Pasos del checklist que faltan por confirmar, en el orden del formato. */
export function pasosPendientes(d: Pick<DerrameDetalle, 'checklist'>): string[] {
  return d.checklist.filter((p) => !p.confirmadoAt).map((p) => p.nombre);
}

/** Se puede marcar como contenido: derrame activo con todos los pasos confirmados. */
export function puedeContener(d: Pick<DerrameDetalle, 'estado' | 'checklist'>): boolean {
  return d.estado === 'activo' && d.checklist.length > 0 && pasosPendientes(d).length === 0;
}

/** El volumen real se confirma (o corrige) con el derrame contenido; cerrado ya no cambia. */
export function puedeConfirmarVolumen(d: Pick<DerrameDetalle, 'estado'>): boolean {
  return d.estado === 'contenido';
}

/** Texto del plazo de contención de 5 minutos, o nulo mientras no se contenga. */
export function textoPlazoContencion(
  d: Pick<DerrameDetalle, 'contencionMinutos' | 'contencionEnPlazo'>,
): string | null {
  if (d.contencionMinutos === null) return null;
  return d.contencionEnPlazo
    ? `Contenido en ${d.contencionMinutos} min (dentro del plazo de ${PLAZO_CONTENCION_MINUTOS} min)`
    : `Contenido en ${d.contencionMinutos} min (fuera del plazo de ${PLAZO_CONTENCION_MINUTOS} min)`;
}

/** Valor numérico de un campo de texto de volumen (acepta coma decimal); `null` si no es un número válido mayor o igual a cero. */
export function leerBarriles(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
