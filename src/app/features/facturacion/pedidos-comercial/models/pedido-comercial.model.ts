import type { DocumentoPedido } from './documentos-pedido';
import type { MacroEstado } from '../../../../shared/models/timeline.model';
import { LINEA_SERVICIO_LABELS, type LineaServicio } from '../../models/pedido.model';

/**
 * Modelos del contenedor `comercial` (backend nuevo, vía gateway: `/api/comercial/pedidos`,
 * `/api/comercial/listas-precios`) y de la lectura de pedidos de AS2 (`/api/as2/pedidos`).
 * Las formas salen de `pedido-mapper.ts` (`toResumen` / `toDetalle`) y de `dto/pedidos.dto.ts`.
 */

export { LINEA_SERVICIO_LABELS };
export type { LineaServicio };

/** Código del tipo de OT (hoy venta, servicio): viene del catálogo `GET /api/comercial/pedidos/tipos-ot`. */
export type TipoOt = string;

export interface CatalogoTipoOt {
  codigo: string;
  nombre: string;
}

// ── Permisos (códigos en `libs/shared/authz/src/lib/permissions.ts`) ──
export const PERMISOS_PEDIDOS = {
  ver: 'comercial.pedidos.ver',
  crear: 'comercial.pedidos.crear',
  editar: 'comercial.pedidos.editar',
  anular: 'comercial.pedidos.anular',
  rechazar: 'comercial.pedidos.rechazar',
  asignarAnalista: 'comercial.pedidos.asignar_analista',
  forzarEstado: 'comercial.pedidos.forzar_estado',
  listasPreciosVer: 'comercial.listas_precios.ver',
  as2PedidosVer: 'integraciones.as2_pedidos.ver',
} as const;

// ── Catálogo de servicios (líneas, tipos y subtipos: viven en base de datos) ──

/** Un subtipo siempre pertenece a un tipo (1:n); el mismo nombre puede existir bajo varios tipos. */
export interface SubtipoServicio {
  tipo: string;
  subtipo: string;
}

export interface CatalogoTipoServicio {
  codigo: string;
  nombre: string;
  subtipos: string[];
}

export interface CatalogoLineaServicio {
  linea: LineaServicio;
  tipos: CatalogoTipoServicio[];
}

/** Respuesta de `GET /api/comercial/pedidos/catalogo-servicios`. */
export interface CatalogoServicios {
  lineas: CatalogoLineaServicio[];
}

// ── Catálogo de estados y flujo ──

export interface EstadoCatalogo {
  codigo: string;
  nombre: string;
  macroEstado: MacroEstado;
  orden: number;
  rolResponsable: string | null;
  terminal: boolean;
}

/** Paso que el backend permite a la persona que consulta (`siguientes` del detalle). */
export interface TransicionDisponible {
  estado: string;
  nombre: string;
  requiereMotivo: boolean;
  regla: string | null;
}

export type OrigenCambioEstado = 'manual' | 'automatico' | 'sincronizacion' | 'forzado' | 'sistema';

export interface HistorialEstado {
  estadoAnterior: string | null;
  estadoNuevo: string;
  nombreEstado: string;
  macroEstado: MacroEstado;
  motivo: string | null;
  actorNombre: string | null;
  actorRol: string | null;
  origen: OrigenCambioEstado;
  fecha: string;
}

export type As2SyncEstado = 'no_aplica' | 'pendiente_de_crear_en_as2' | 'vinculado' | 'error';
export type OrigenPedido = 'portal' | 'as2';

// ── Pedido: lista y detalle ──

export interface PedidoResumen {
  id: string;
  codigo: string | null;
  /** Número de ticket: el mismo que tendrá la prefactura (se reserva al abrir el pedido). `null` en pedidos anteriores o aún en borrador. */
  ticketNumero: number | null;
  origen: OrigenPedido;
  estado: string;
  estadoNombre: string;
  macroEstado: MacroEstado;
  rolResponsable: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  lineaServicio: LineaServicio | null;
  tipoOt: TipoOt | null;
  tiposServicio: string[];
  campoNombre: string | null;
  pozoNombre: string | null;
  taladroNombre: string | null;
  agenteComercialNombre: string | null;
  analistaFacturacionNombre: string | null;
  fechaInicioServicio: string | null;
  fechaFinServicio: string | null;
  as2Numero: string | null;
  as2Estado: string | null;
  as2SyncEstado: As2SyncEstado;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PedidosPagina {
  items: PedidoResumen[];
  total: number;
  page: number;
  limit: number;
}

export interface ItemPedido {
  id: string;
  orden: number;
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number;
  valorUnitario: number;
  descuentoPct: number | null;
  origenItem: string | null;
  listaPreciosItemId: string | null;
  bruto: number;
  descuento: number;
  neto: number;
}

export interface PersonaResponsable {
  id: string | null;
  nombre: string | null;
}

export interface PedidoAs2 {
  idPedidoCliente: number | null;
  numero: string | null;
  estado: string | null;
  fecha: string | null;
  total: number | null;
  descuento: number | null;
  impuesto: number | null;
  /** `total − descuento + impuesto`; `total` es el subtotal bruto. */
  totalFinal: number | null;
  descripcion: string | null;
  syncEstado: As2SyncEstado;
  vinculoMetodo: string | null;
  sincronizadoAt: string | null;
}

export interface PedidoDetalle {
  id: string;
  codigo: string | null;
  /** Número de ticket: el mismo que tendrá la prefactura (se reserva al abrir el pedido). */
  ticketNumero: number | null;
  /** El ticket de Operaciones que lo atiende y el código de su paso actual (null si todavía no se abrió). */
  ticketOperativo: {
    origen: 'pumping' | 'fcr';
    ticketId: string;
    pasoCodigo: string;
    actualizadoAt: string;
  } | null;
  version: number;
  origen: OrigenPedido;
  estado: string;
  estadoNombre: string;
  macroEstado: MacroEstado;
  rolResponsable: string | null;
  terminal: boolean;
  motivoAnulacion: string | null;
  anuladoAt: string | null;
  cliente: {
    id: string | null;
    nombre: string | null;
    ruc: string | null;
    subcliente: string | null;
  };
  lineaServicio: LineaServicio | null;
  tipoOt: TipoOt | null;
  tiposServicio: string[];
  subtiposServicio: SubtipoServicio[];
  ubicacion: {
    campoId: string | null;
    campo: string | null;
    bloqueId: string | null;
    bloque: string | null;
    pozoId: string | null;
    pozo: string | null;
    taladroId: string | null;
    taladro: string | null;
    rigless: boolean;
  };
  numeroContrato: string | null;
  fechaInicioServicio: string | null;
  fechaFinServicio: string | null;
  responsables: {
    agenteComercial: PersonaResponsable;
    representanteCampo: PersonaResponsable;
    representanteQuito: PersonaResponsable;
    tecnicoHse: PersonaResponsable;
    analistaFacturacion: PersonaResponsable & { asignadoAt: string | null };
  };
  administrativo: {
    bodegaId: string | null;
    bodega: string | null;
    condicionPagoId: string | null;
    condicionPago: string | null;
    zonaId: string | null;
    zona: string | null;
    solicitudMedio: 'verbal' | 'escrita' | null;
  };
  items: ItemPedido[];
  totales: { subtotal: number; descuento: number; neto: number };
  as2: PedidoAs2;
  createdAt: string;
  updatedAt: string;
  /** El pedido admite edición en su estado actual. */
  editable: boolean;
  historial: HistorialEstado[];
  /** Documentos adjuntos (módulo de archivos). */
  documentos: DocumentoPedido[];
  /** Pasos manuales que ESTA persona puede dar desde el estado actual. */
  siguientes: TransicionDisponible[];
  puedeForzar: boolean;
}

// ── Solicitudes ──

export interface ItemPedidoRequest {
  listaPreciosItemId: string;
  cantidad: number;
  descuentoPct?: number;
  origen?: 'lista' | 'plantilla';
}

/** Cuerpo común de crear y editar. En edición, lo ausente no se toca y `items` REEMPLAZA todos los ítems. */
export interface DatosPedidoRequest {
  clienteId?: string;
  subcliente?: string;
  lineaServicio?: LineaServicio;
  tipoOt?: TipoOt;
  tiposServicio?: string[];
  subtiposServicio?: SubtipoServicio[];
  campoId?: string;
  bloqueId?: string;
  pozoId?: string;
  taladroId?: string;
  rigless?: boolean;
  numeroContrato?: string;
  fechaInicioServicio?: string;
  fechaFinServicio?: string;
  agenteComercialId?: string;
  tecnicoHseId?: string;
  representanteCampoId?: string;
  representanteQuitoId?: string;
  /** UUID del catálogo o `null` para dejarlo sin valor; la zona se calcula y no se envía. */
  condicionPagoId?: string | null;
  bodegaId?: string | null;
  solicitudMedio?: 'verbal' | 'escrita';
  items?: ItemPedidoRequest[];
}

export interface CrearPedidoRequest extends DatosPedidoRequest {
  /** `true` valida todo, emite el código y abre; por defecto queda en borrador ("por completar"). */
  abrir?: boolean;
}

export interface ActualizarPedidoRequest extends DatosPedidoRequest {
  version: number;
}

export interface FiltrosPedidos {
  estado?: string | null;
  estados?: string[];
  linea?: LineaServicio | null;
  origen?: OrigenPedido | null;
  clienteId?: string | null;
  q?: string | null;
  sinAnalista?: boolean;
  as2Sync?: As2SyncEstado | null;
  page?: number;
  limit?: number;
}

export interface VinculoAs2 {
  as2IdPedidoCliente: number;
  id: string;
  codigo: string | null;
  estado: string;
}

export interface FilaPlantilla {
  codigo: string;
  cantidad: number;
  precio?: number;
  descuentoPct?: number;
}

export interface ItemPlantillaValidado {
  fila: number;
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number;
  precioLista: number;
  descuentoPct: number | null;
  /** Diferencia entre el precio del archivo y el de la lista (el válido es el de la lista). */
  diferenciaPrecio: number | null;
  origen: 'plantilla';
}

export interface ErrorPlantilla {
  fila: number;
  codigo: string;
  motivo: string;
}

export interface ResultadoValidarPlantilla {
  items: ItemPlantillaValidado[];
  errores: ErrorPlantilla[];
}

/** Resultado de cargar solas las líneas de AS2 al crear el pedido (null si AS2 no entregó líneas o el cliente no está en el catálogo). */
export interface LineasAs2Cargadas {
  importados: number;
  sinCoincidencia: string[];
}

/** Pedido recién creado desde AS2: el detalle más lo que pasó con sus líneas. */
export type PedidoCreadoDesdeAs2 = PedidoDetalle & { lineasAs2: LineasAs2Cargadas | null };

export interface ResultadoImportarLineas {
  importados: number;
  sinCoincidencia: string[];
  pedido: PedidoDetalle;
}

// ── Listas de precios ──

export interface ListaPreciosResumen {
  id: string;
  clienteId: string;
  clienteNombre: string | null;
  numeroContrato: string | null;
  vigenteDesde: string;
  activa: boolean;
  items: number;
  /** Cuántos ítems de cada tipo tiene la lista y cuánto suman sus precios unitarios (no es un total a cobrar). */
  servicios?: TotalTipoLista;
  materiales?: TotalTipoLista;
}

export interface TotalTipoLista {
  cantidad: number;
  suma: number;
}

export type TipoItemLista = 'Material' | 'Servicio';

export interface ItemListaCliente {
  listaPreciosItemId: string;
  listaPreciosId: string;
  numeroContrato: string | null;
  codigo: string;
  descripcion: string;
  unidad: string | null;
  precio: number;
  tipo: TipoItemLista;
}

export interface ItemLista {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string | null;
  precio: number;
  tipo: TipoItemLista;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface FiltroItemsLista {
  q?: string;
  tipo?: TipoItemLista | null;
  page?: number;
  limit?: number;
}

// ── Pedidos de AS2 (solo lectura) ──

export type As2LineasEstado = 'con_lineas' | 'sin_lineas';

export interface As2Linea {
  codigo: string | null;
  nombre: string | null;
  cantidad: number;
  precio: number;
}

export interface As2PedidoResumen {
  idPedidoCliente: number;
  numero: string | null;
  fecha: string | null;
  estado: string | null;
  total: number;
  descuento: number;
  impuesto: number;
  descripcion: string | null;
  empresaNombre: string | null;
  empresaIdentificacion: string | null;
  bodega: string | null;
  condicionPago: string | null;
  zona: string | null;
  lineasEstado: As2LineasEstado;
  lineas?: As2Linea[];
}

export interface As2PedidosPagina {
  page: number;
  limit: number;
  hayMas: boolean;
  /** `null` cuando AS2 no permite un total exacto (búsqueda por texto o filtro de líneas). */
  total: number | null;
  items: As2PedidoResumen[];
}

export interface As2PedidosFiltro {
  page?: number;
  limit?: number;
  estado?: string | null;
  lineas?: 'con' | 'sin' | null;
  q?: string | null;
}

export interface As2Resumen {
  total: number;
  porEstado: Record<string, number>;
}

// ── Etiquetas ──

export const SYNC_AS2_LABELS: Record<As2SyncEstado, string> = {
  no_aplica: 'No aplica',
  pendiente_de_crear_en_as2: 'Pendiente de AS2',
  vinculado: 'Vinculado con AS2',
  error: 'Error de sincronización',
};

export const ORIGEN_LABELS: Record<OrigenPedido, string> = { portal: 'Portal', as2: 'AS2' };

export const ORIGEN_CAMBIO_LABELS: Record<OrigenCambioEstado, string> = {
  manual: 'Manual',
  automatico: 'Automático',
  sincronizacion: 'Sincronización',
  forzado: 'Forzado',
  sistema: 'Sistema',
};

export const SOLICITUD_MEDIO_LABELS = { verbal: 'Verbal', escrita: 'Escrita' } as const;

/** Estados desde los que el pedido se puede abrir (el botón "Abrir" solo aparece en ellos). */
export const ESTADOS_ABRIBLES: readonly string[] = ['borrador', 'en_correccion'];

/** Mínimo de caracteres del motivo al forzar un estado (regla del backend). */
export const MIN_MOTIVO_FORZADO = 5;

/** Tamaño de página de la pestaña "Por completar" (AS2 cobra una consulta de líneas por pedido). */
export const LIMITE_POR_COMPLETAR = 10;
/** Tamaño de página de la lista de pedidos del portal. */
export const LIMITE_PEDIDOS = 20;

// ── Lógica pura ──

const redondeo = (n: number): number => Math.round(n * 100) / 100;

export interface ImportesItem {
  bruto: number;
  descuento: number;
  neto: number;
}

/** Importes de un ítem con la misma regla del backend (`importesItem`): bruto, descuento y neto a dos decimales. */
export function importesItem(
  cantidad: number,
  valorUnitario: number,
  descuentoPct: number | null | undefined,
): ImportesItem {
  const bruto = redondeo(cantidad * valorUnitario);
  const descuento = redondeo((bruto * (descuentoPct ?? 0)) / 100);
  return { bruto, descuento, neto: redondeo(bruto - descuento) };
}

export function totalesItems(items: readonly Pick<ImportesItem, 'bruto' | 'descuento'>[]): {
  subtotal: number;
  descuento: number;
  neto: number;
} {
  const subtotal = redondeo(items.reduce((a, i) => a + i.bruto, 0));
  const descuento = redondeo(items.reduce((a, i) => a + i.descuento, 0));
  return { subtotal, descuento, neto: redondeo(subtotal - descuento) };
}

/** Total final de AS2: `total` es el subtotal bruto, así que se resta el descuento y se suma el impuesto. */
export function totalFinalAs2(
  total: number | null,
  descuento: number | null,
  impuesto: number | null,
): number | null {
  if (total === null) return null;
  return redondeo(total - (descuento ?? 0) + (impuesto ?? 0));
}

const FORMATO_MONEDA = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatoMoneda(valor: number | null | undefined): string {
  return valor === null || valor === undefined || Number.isNaN(valor)
    ? '—'
    : FORMATO_MONEDA.format(valor);
}

/** `AAAA-MM-DD` → `DD/MM/AAAA` (sin pasar por `Date`, para no correr el día por la zona horaria). */
export function formatoDia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

/** Nombre del tipo de OT según el catálogo (si no cargó, el propio código). */
export function etiquetaTipoOt(
  catalogo: readonly CatalogoTipoOt[],
  codigo: string | null | undefined,
): string {
  if (!codigo) return '—';
  return catalogo.find((t) => t.codigo === codigo)?.nombre ?? codigo;
}

export function tiposDeLinea(
  catalogo: CatalogoServicios | null | undefined,
  linea: LineaServicio | null | undefined,
): CatalogoTipoServicio[] {
  return catalogo?.lineas.find((l) => l.linea === linea)?.tipos ?? [];
}

/** "milling_tools" → "Milling Tools" cuando el catálogo aún no cargó. */
function humanizar(codigo: string): string {
  return codigo.replace(/_/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function etiquetaTipoServicio(
  catalogo: CatalogoServicios | null | undefined,
  codigo: string,
): string {
  for (const l of catalogo?.lineas ?? []) {
    const t = l.tipos.find((x) => x.codigo === codigo);
    if (t) return t.nombre;
  }
  return humanizar(codigo);
}

export function etiquetasTiposServicio(
  catalogo: CatalogoServicios | null | undefined,
  codigos: readonly string[] | null | undefined,
): string {
  return codigos?.length ? codigos.map((c) => etiquetaTipoServicio(catalogo, c)).join(', ') : '—';
}

/** Subtipos con su tipo, para mostrar: "Milling (Casing Repair), Sand Bailer (Fishing)". */
export function etiquetasSubtipos(
  catalogo: CatalogoServicios | null | undefined,
  subtipos: readonly SubtipoServicio[] | null | undefined,
): string {
  return subtipos?.length
    ? subtipos.map((s) => `${s.subtipo} (${etiquetaTipoServicio(catalogo, s.tipo)})`).join(', ')
    : '—';
}

const SEPARADOR_CLAVE = '::';

/** Clave única de un subtipo dentro de un select (el mismo nombre puede repetirse en varios tipos). */
export function claveSubtipo(s: SubtipoServicio): string {
  return `${s.tipo}${SEPARADOR_CLAVE}${s.subtipo}`;
}

export function subtipoDesdeClave(clave: string): SubtipoServicio | null {
  const i = clave.indexOf(SEPARADOR_CLAVE);
  return i <= 0
    ? null
    : { tipo: clave.slice(0, i), subtipo: clave.slice(i + SEPARADOR_CLAVE.length) };
}

export interface OpcionSubtipo {
  label: string;
  value: string;
  group: string;
}

/** Subtipos que ofrece cada tipo elegido, agrupados por el nombre del tipo. */
export function opcionesSubtipos(
  catalogo: CatalogoServicios | null | undefined,
  linea: LineaServicio | null | undefined,
  tipos: readonly string[],
): OpcionSubtipo[] {
  const elegidos = new Set(tipos);
  return tiposDeLinea(catalogo, linea)
    .filter((t) => elegidos.has(t.codigo))
    .flatMap((t) =>
      t.subtipos.map((s) => ({
        label: s,
        value: claveSubtipo({ tipo: t.codigo, subtipo: s }),
        group: t.nombre,
      })),
    );
}

/** Al quitar un tipo se quitan también sus subtipos (y los que ya no existan en el catálogo). */
export function subtiposVigentes(
  catalogo: CatalogoServicios | null | undefined,
  linea: LineaServicio | null | undefined,
  tipos: readonly string[],
  subtipos: readonly SubtipoServicio[],
): SubtipoServicio[] {
  const validas = new Set(opcionesSubtipos(catalogo, linea, tipos).map((o) => o.value));
  return subtipos.filter((s) => validas.has(claveSubtipo(s)));
}

/** Al cambiar la línea, descarta los tipos que ya no le corresponden. */
export function tiposCompatibles(
  catalogo: CatalogoServicios | null | undefined,
  linea: LineaServicio | null,
  tipos: readonly string[],
): string[] {
  const validos = new Set(tiposDeLinea(catalogo, linea).map((t) => t.codigo));
  return tipos.filter((t) => validos.has(t));
}

export interface BorradorPedido {
  clienteId: string | null;
  lineaServicio: LineaServicio | null;
  tipoOt: TipoOt | null;
  tiposServicio: readonly string[];
  campoId: string | null;
  pozoId: string | null;
  taladroId: string | null;
  rigless: boolean;
  numeroContrato: string;
  fechaInicioServicio: string | null;
  fechaFinServicio: string | null;
  tecnicoHseId: string | null;
  bodegaId: string | null;
  cantidadItems: number;
}

/**
 * Qué le falta a un pedido para poder "abrirse". Espejo de `faltantes()` del backend (que es la autoridad): sirve para
 * avisar antes de enviar. El agente comercial no se pide porque por defecto es quien crea el pedido.
 */
export function faltantesParaAbrir(p: BorradorPedido): string[] {
  const f: string[] = [];
  if (!p.clienteId) f.push('cliente');
  if (!p.lineaServicio) f.push('línea de servicio');
  if (!p.tipoOt) f.push('tipo de OT');
  if (p.tiposServicio.length === 0) f.push('tipo de servicio');
  if (!p.campoId) f.push('campo');
  if (!p.pozoId) f.push('pozo');
  if (!p.rigless && !p.taladroId) f.push('taladro (o marcar "rigless")');
  if (!p.numeroContrato.trim()) f.push('número de contrato');
  if (!p.fechaInicioServicio) f.push('fecha de inicio del servicio');
  if (!p.fechaFinServicio) f.push('fecha de fin del servicio');
  if (!p.tecnicoHseId) f.push('técnico HSE');
  if (!p.bodegaId) f.push('bodega');
  if (p.cantidadItems === 0) f.push('al menos un ítem de la lista de precios');
  return f;
}

/** Valida coherencias que el backend rechazaría; devuelve el primer mensaje o `null`. */
export function errorCoherencia(
  p: Pick<BorradorPedido, 'fechaInicioServicio' | 'fechaFinServicio' | 'rigless' | 'taladroId'>,
): string | null {
  if (p.fechaInicioServicio && p.fechaFinServicio && p.fechaFinServicio < p.fechaInicioServicio) {
    return 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  if (p.rigless && p.taladroId) return 'Un trabajo "rigless" no lleva taladro.';
  return null;
}

/** Pedido terminado, sin analista y no anulado: lo que ve la jefa de Facturación en su bandeja. */
export function estaSinAnalista(
  p: Pick<PedidoResumen, 'analistaFacturacionNombre' | 'estado'>,
): boolean {
  return !p.analistaFacturacionNombre && p.estado !== 'anulado';
}

/** Texto "Mostrando 1–10 de 35 · Página 1 de 4" (o sin total cuando AS2 no lo da). */
export function resumenPaginacion(
  page: number,
  limit: number,
  cantidad: number,
  total: number | null,
): string {
  if (cantidad === 0) return 'Sin resultados';
  const desde = (page - 1) * limit + 1;
  const hasta = desde + cantidad - 1;
  if (total === null) return `Mostrando ${desde}–${hasta} · Página ${page}`;
  const paginas = Math.max(1, Math.ceil(total / limit));
  return `Mostrando ${desde}–${hasta} de ${total} · Página ${page} de ${paginas}`;
}

/** ¿Hay página siguiente? Con total conocido se calcula; sin él manda `hayMas` de AS2. */
export function haySiguiente(
  page: number,
  limit: number,
  total: number | null,
  hayMas: boolean,
): boolean {
  return total === null ? hayMas : page * limit < total;
}

/** El paso exige motivo (lo dice el backend en `siguientes`). */
export function pasoRequiereMotivo(paso: Pick<TransicionDisponible, 'requiereMotivo'>): boolean {
  return paso.requiereMotivo;
}

/**
 * Pasos que la pantalla pinta como botones del flujo. `anulado` y `en_correccion` se excluyen porque ya tienen su botón
 * propio (Anular / Rechazar) con la misma regla del backend: no se hardcodea el flujo, solo se evita duplicar acciones.
 */
export function pasosDeFlujo(
  siguientes: readonly TransicionDisponible[],
  conBotonPropio: readonly string[] = ['anulado', 'en_correccion'],
): TransicionDisponible[] {
  return siguientes.filter((s) => !conBotonPropio.includes(s.estado));
}

/** ¿Existe ese paso entre los disponibles? (para mostrar Anular / Rechazar solo si el backend lo permite). */
export function puedeDarPaso(
  siguientes: readonly TransicionDisponible[],
  estado: string,
): TransicionDisponible | undefined {
  return siguientes.find((s) => s.estado === estado);
}

/** Mensaje legible de un error HTTP del backend nuevo (`{ message: string | string[] }`). */
export function mensajeDeError(err: unknown, porDefecto: string): string {
  const cuerpo = (err as { error?: { message?: unknown } } | null)?.error;
  const m = cuerpo?.message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join('. ') || porDefecto;
  if (typeof m === 'string' && m.trim()) return m;
  return porDefecto;
}

/** ¿El error es el 409 de edición concurrente / estado? */
export function esConflicto(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 409;
}
