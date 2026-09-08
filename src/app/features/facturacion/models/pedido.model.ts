/**
 * Fase 0 — Reescritura del módulo de Facturación.
 *
 * El **Pedido** es la entidad ancla (reemplaza a `Otq` de la versión
 * anterior). Nace en AS2 o en el Portal (bidireccional) y lleva el número
 * secuencial que comparte con AS2. Ventas lo abre con la cabecera completa
 * y **una sola línea estimada** — el mínimo que AS2 exige para crear el
 * trabajo y la base "cotizado" del reporte cotizado-vs-real.
 *
 * Ver `documentacion/facturacion/PLAN-MODULO-FACTURACION.md` (§2, §3, §6).
 */

export type LineaServicio = 'fishing' | 'pumping' | 'completion' | 'ctu';

export const LINEA_SERVICIO_LABELS: Record<LineaServicio, string> = {
  fishing: 'Fishing',
  pumping: 'Pumping',
  completion: 'Completion',
  ctu: 'CTU',
};

/**
 * Máquina de estados del Pedido — alineada con la dimensión STATUS de
 * `VENTAS_DYNADRILL_2026.xlsm` y con Estado Servicio/TKT/OT del Secuencial
 * Tk Control. El alcance del app termina en `aot_generada`; los tres
 * últimos son placeholders (registro AS2 / SRI / cobro quedan fuera).
 */
export type EstadoPedido =
  | 'borrador'
  | 'abierto'
  | 'en_operacion'
  | 'en_elaboracion_operativa'
  | 'documentos_completos'
  | 'en_revision_prefacturacion'
  | 'en_correccion'
  | 'prefactura_generada'
  | 'enviado_para_firmas'
  | 'rechazado_por_cliente'
  | 'ticket_firmado'
  | 'aot_generada'
  // ── Fuera de alcance del app (placeholders) ──
  | 'enviado_a_control_de_costos'
  | 'listo_para_facturar'
  | 'facturado';

export const ESTADO_PEDIDO_LABELS: Record<EstadoPedido, string> = {
  borrador: 'Borrador',
  abierto: 'Abierto',
  en_operacion: 'En operación',
  en_elaboracion_operativa: 'En elaboración (Operaciones)',
  documentos_completos: 'Documentos completos',
  en_revision_prefacturacion: 'En revisión de prefacturación',
  en_correccion: 'En corrección',
  prefactura_generada: 'Prefactura generada',
  enviado_para_firmas: 'Enviado para firmas',
  rechazado_por_cliente: 'Rechazado por el cliente',
  ticket_firmado: 'Ticket firmado',
  aot_generada: 'AOT generada',
  enviado_a_control_de_costos: 'Enviado a Control de Costos',
  listo_para_facturar: 'Listo para facturar',
  facturado: 'Facturado',
};

/** Estados que ya no son responsabilidad operativa del app (solo lectura / reportería). */
export const ESTADOS_FUERA_DE_ALCANCE: readonly EstadoPedido[] = [
  'enviado_a_control_de_costos',
  'listo_para_facturar',
  'facturado',
];

export type PedidoOrigen = 'as2' | 'portal';

/** Línea estimada única que Ventas captura al abrir el Pedido (decisión 10 del plan). */
export interface ItemEstimado {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
}

export interface CambioEstado {
  estado: EstadoPedido;
  fecha: string;
  usuario: string;
  motivo?: string;
}

export interface Pedido {
  id: number;
  /** Secuencial compartido con AS2 (ej. "4313"). Lo asigna el gateway. */
  code: string;
  origen: PedidoOrigen;
  as2Ref?: string;
  lastSyncedAt?: string;

  // ── Cliente ──
  cliente: string;
  clienteRuc?: string;
  subcliente?: string;

  // ── Servicio ──
  lineaServicio: LineaServicio;
  campo: string;
  bloque: string;
  pozo: string;
  taladroRig: string;
  /** Ids de los catálogos de ubicación — para que los tickets derivados no re-pregunten campo/bloque/pozo/taladro. */
  campoId?: number;
  bloqueId?: number;
  pozoId?: number;
  nombreCompletoPozo?: string;
  taladroId?: number;
  numeroContrato: string;

  // ── Comercial / responsables ──
  agenteComercial: string;
  representanteCampo: string;
  representanteQuito: string;
  analistaFacturacion?: string;

  // ── Administrativos (del formulario de prefactura de AS2) ──
  condicionPago?: string;
  zona?: string;
  canal?: string;
  bodega?: string;
  /** "Verbal ( ) / Escrita ( x )" del formato real de prefactura — cómo llegó la solicitud del servicio. */
  solicitudMedio?: 'verbal' | 'escrita';

  // ── Estimado (1 línea) ──
  itemEstimado: ItemEstimado;

  // ── Fechas ──
  fechaInicioServicio?: string;
  fechaFinServicio?: string;

  // ── Estado ──
  estado: EstadoPedido;
  historialEstados: CambioEstado[];

  createdAt: string;
  createdBy: string;
}

export type CreatePedidoInput = Omit<
  Pedido,
  'id' | 'code' | 'estado' | 'historialEstados' | 'createdAt' | 'lastSyncedAt' | 'as2Ref'
>;

/** Valor cotizado del Pedido — base del reporte "cotizado vs. real". */
export function valorEstimadoPedido(p: Pick<Pedido, 'itemEstimado'>): number {
  return Math.round(p.itemEstimado.cantidad * p.itemEstimado.valorUnitario * 100) / 100;
}
