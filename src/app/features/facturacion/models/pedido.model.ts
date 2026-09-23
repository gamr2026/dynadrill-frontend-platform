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

import type { MacroEstado, TimelineResumen } from '../../../shared/models/timeline.model';

export type LineaServicio = 'fcr' | 'pumping';

export const LINEA_SERVICIO_LABELS: Record<LineaServicio, string> = {
  fcr: 'FCR',
  pumping: 'Pumping',
};

/**
 * Tipo de servicio — segundo select, depende de la línea elegida
 * (TIPOS_SERVICIO_POR_LINEA). Reemplaza la granularidad que antes daba
 * `LineaServicio` con 4 valores (fishing/completion/ctu eran línea de
 * servicio propia); ahora esos 3 son tipos de servicio de FCR, y "Coiled
 * Tubing" (ex-CTU) pasa a ser tipo de servicio de Pumping, no de FCR.
 *
 * Catálogo real de FCR (columna "Tipo de Servicio" del KPI Ventas
 * Consolidado, hoja "datos1") — los primeros 4 son los que ya existían
 * antes de este catálogo real (y tienen cobertura IPERC ya cargada, ver
 * IpercCoberturaLinea); los 11 restantes son nuevos y arrancan sin
 * actividades IPERC asignadas (QHSE las completa desde su UI).
 */
export type TipoServicio =
  | 'wellbore_cleanup_tools'
  | 'fishing_services'
  | 'remedial_tools'
  | 'completion_tools'
  | 'lower_completion'
  | 'milling'
  | 'casing_repair'
  | 'thru_tubing'
  | 'esp_equipment'
  | 'flow_control_tools'
  | 'liner_hanger'
  | 'pesca_wireline_tools'
  | 'pipe_recovery'
  | 'servicios_integrados'
  | 'slickline'
  | 'coiled_tubing'
  | 'cementing';

export const TIPO_SERVICIO_LABELS: Record<TipoServicio, string> = {
  wellbore_cleanup_tools: 'Wellbore Clean Up Tools',
  fishing_services: 'Fishing Services',
  remedial_tools: 'Remedial Tools',
  completion_tools: 'Completion Tools',
  lower_completion: 'Lower Completion',
  milling: 'Milling',
  casing_repair: 'Casing Repair',
  thru_tubing: 'Thru Tubing',
  esp_equipment: 'ESP Equipment',
  flow_control_tools: 'Flow Control Tools',
  liner_hanger: 'Liner Hanger',
  pesca_wireline_tools: 'Pesca Wireline Tools',
  pipe_recovery: 'Pipe Recovery',
  servicios_integrados: 'Servicios Integrados',
  slickline: 'Slickline',
  coiled_tubing: 'Coiled Tubing',
  cementing: 'Cementing',
};

export const TIPOS_SERVICIO_POR_LINEA: Record<LineaServicio, TipoServicio[]> = {
  fcr: [
    'wellbore_cleanup_tools',
    'fishing_services',
    'remedial_tools',
    'completion_tools',
    'lower_completion',
    'milling',
    'casing_repair',
    'thru_tubing',
    'esp_equipment',
    'flow_control_tools',
    'liner_hanger',
    'pesca_wireline_tools',
    'pipe_recovery',
    'servicios_integrados',
    'slickline',
  ],
  pumping: ['coiled_tubing', 'cementing'],
};

/** Un pedido puede llevar más de un tipo de servicio en la misma OT (ej. Fishing + Milling) — para mostrarlos juntos como texto. */
export function tiposServicioLabel(tipos: TipoServicio[]): string {
  return tipos.map(t => TIPO_SERVICIO_LABELS[t]).join(', ');
}

/**
 * Sub-tipo de servicio — tercer select, columna "SUB-SERVICIOS" del KPI
 * Ventas Consolidado, hoja "datos1". Depende de los Tipos de servicio
 * elegidos (varios tipos → unión de sus sub-tipos, sin agrupar). A
 * diferencia de `TipoServicio`, no está acoplado a la cobertura IPERC —
 * es solo texto descriptivo del pedido, así que se modela como lista de
 * strings libres (más fácil de mantener a medida que Ventas agrega
 * variantes) en vez de un union type estricto.
 */
export const SUBTIPOS_SERVICIO_POR_TIPO: Record<TipoServicio, string[]> = {
  wellbore_cleanup_tools: ['Milling', 'Run Venturi Basket', 'Sand Bailer', 'Sand Bailer + Multiplier', 'WBCU Tools', 'WBCU-Milling'],
  fishing_services: [
    'Casing Pulling Tool',
    'Centralizador',
    'Fishing CIBP',
    'Hydraulic Packers',
    'Milling',
    'Milling-Motor',
    'Pesca Cable Slick Line',
    'Pesca CTU',
    'Pesca Hanger',
    'Pesca Wireline Tools',
    'Protector Lizer',
    'Renta de Drillpipe 2 3/8',
  ],
  remedial_tools: ['Run CIBP + HST', 'Run CR + HST', 'Services Packer', 'Squeeze Jobs'],
  completion_tools: ['Completion Specialist', 'Flow Control Tools', 'Hydraulic Packers', 'Mechanical Packers', 'Seal Bore Packer', 'Services Packer'],
  lower_completion: ['Cavidad Guiberson', 'Completación Inteligente', 'Max-R', 'One Trip', 'Seal Bore Packer', 'Selective Completion', 'SXAR-E'],
  milling: ['Mill Cement & CR', 'Milling', 'Milling CIBP', 'Milling-Motor'],
  casing_repair: ['Casing Repair'],
  thru_tubing: ['Thru Tubing'],
  esp_equipment: ["Camisa Refrigeración 5 1/2", "Camisa Refrigeración 7''", 'Casing Pulling Tool', 'Dual ESP', 'ESP Equipment'],
  flow_control_tools: ['Reparación FCT'],
  liner_hanger: ["Top Packer 7 x 9 5/8''"],
  pesca_wireline_tools: ['Pesca Wireline Tools'],
  pipe_recovery: ['External Cutter'],
  servicios_integrados: ['Squeeze Jobs'],
  slickline: ['Servicios de Slickline'],
  coiled_tubing: [],
  cementing: [],
};

/** Unión (sin duplicados) de los sub-tipos disponibles para los Tipos de servicio elegidos. */
export function subTiposServicioDisponibles(tipos: TipoServicio[]): string[] {
  return [...new Set(tipos.flatMap(t => SUBTIPOS_SERVICIO_POR_TIPO[t]))];
}

/**
 * Clasifica un pedido como Venta o Servicio para el reporte de Facturación
 * — antes solo aplicaba a FCR (decidía qué entrada del FcrTicket derivado
 * se usa) y quedaba oculto/sin sentido para Pumping; ahora se pide
 * siempre, para ambas líneas, específicamente para poder contar ese
 * reporte también sobre los pedidos de Pumping.
 */
export type TipoOt = 'venta' | 'servicio';

export const TIPO_OT_LABELS: Record<TipoOt, string> = {
  venta: 'Venta',
  servicio: 'Servicio',
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
  /** Facturación pidió a Bodega el despacho de materiales/herramientas (correlación con "Orden Salida Material" de AS2) — vuelve a `prefactura_generada` al despacharse o rechazarse. */
  | 'por_despachar_bodega'
  | 'enviado_para_firmas'
  | 'rechazado_por_cliente'
  | 'ticket_firmado'
  | 'aot_generada'
  /** Cierre definitivo — puede pasar en cualquier punto del flujo (ver `ESTADOS_NO_ANULABLES` en facturacion-domain.service.ts). "Anulado" del Excel real "Secuencial Tk Control". */
  | 'anulado'
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
  por_despachar_bodega: 'Por despachar en bodega',
  enviado_para_firmas: 'Enviado para firmas',
  rechazado_por_cliente: 'Rechazado por el cliente',
  ticket_firmado: 'Ticket firmado',
  aot_generada: 'OT generada',
  anulado: 'Anulado',
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

/** Estados en los que Facturación todavía puede rechazar el pedido a Ventas — espejo de `ESTADOS_RECHAZABLES` en `facturacion-domain.service.ts`. */
export const ESTADOS_RECHAZABLES: readonly EstadoPedido[] = [
  'abierto',
  'en_operacion',
  'en_elaboracion_operativa',
  'documentos_completos',
  'en_revision_prefacturacion',
];

/** Estados desde los que YA NO se puede anular el pedido (cerrado) — espejo de `ESTADOS_NO_ANULABLES` en `facturacion-domain.service.ts`. Cualquier otro estado admite anular. */
export const ESTADOS_NO_ANULABLES: readonly EstadoPedido[] = ['anulado', 'facturado'];

export type PedidoOrigen = 'as2' | 'portal';

/** Línea estimada que Ventas captura al abrir el Pedido — base "cotizado" del reporte cotizado-vs-real. */
export interface ItemEstimado {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  /** % de descuento de la línea — de la plantilla "AS2 Pedido Cliente.xlsx" ("Porcentaje Descuento"). No todas las líneas lo traen. */
  descuentoPorcentaje?: number;
  /** Ventas marca acá qué líneas son químicos — Pumping los precarga en "Asignar recursos" en vez de tener que volver a elegirlos del catálogo de Inventario. */
  esQuimico?: boolean;
  /** Igual que `esQuimico`, pero para herramientas de Inventario (categoría HERRAMIENTAS). */
  esHerramienta?: boolean;
}

export interface CambioEstado {
  estado: EstadoPedido;
  fecha: string;
  usuario: string;
  motivo?: string;
  /** Agregados por el backend junto con `timelineResumen` — opcionales porque el historial de pedidos viejos no siempre los trae. */
  macroEstado?: MacroEstado;
  actorRol?: string;
}

/**
 * Documento de referencia adjuntado por Ventas al crear el pedido — hoy
 * solo se pide para Pumping (ver nuevo-pedido-dialog), para que el
 * Supervisor sepa de qué se trata un archivo ya provisto (ej. ficha de
 * mezcla de químicos) sin tener que volver a pedirlo. Subida real a disco
 * (backend `PedidoDocumento` / `PedidoDocumentosService`) — se lee/escribe
 * vía `PedidoService.listarDocumentosAdjuntos/subirDocumentoAdjunto/...`,
 * NO como parte del payload del propio Pedido (por eso no es un campo de
 * `Pedido` acá abajo).
 */
export interface PedidoDocumentoAdjunto {
  id: number;
  descripcion: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  uploadedAt: string;
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
  /** Referencia real a ClienteCatalogo — sin esto la prefactura solo puede matchear la Lista de Precios por texto libre (bug $0 reportado cuando dos strings distintos representan el mismo cliente real). */
  clienteId?: number;
  subcliente?: string;

  // ── Servicio ──
  lineaServicio: LineaServicio;
  /** Un pedido puede tener más de un tipo de servicio en la misma OT (ej. Fishing + Milling). */
  tipoServicio: TipoServicio[];
  /** Sub-tipos técnicos de los Tipos de servicio elegidos (ver SUBTIPOS_SERVICIO_POR_TIPO) — solo descriptivo, opcional. */
  subTipoServicio?: string[];
  tipoOt: TipoOt;
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
  /**
   * FACT-001 Fase 2/3: "Asignar Técnico HSE responsable" + "el sistema
   * valida que tenga el rol correspondiente activo antes de activar el
   * ticket". El backend resuelve `Nombre` desde el usuario real al crear
   * el pedido — no se manda como texto libre.
   */
  tecnicoHseResponsableId: number;
  tecnicoHseResponsableNombre?: string;

  // ── Administrativos (del formulario de prefactura de AS2) ──
  condicionPago?: string;
  zona?: string;
  bodega?: string;
  /** "Verbal ( ) / Escrita ( x )" del formato real de prefactura — cómo llegó la solicitud del servicio. */
  solicitudMedio?: 'verbal' | 'escrita';

  // ── Estimado (1 o varias líneas) ──
  itemsEstimados: ItemEstimado[];
  /** @deprecated Compat: pedidos antiguos guardaban una sola línea. El backend normaliza a `itemsEstimados`. */
  itemEstimado?: ItemEstimado;

  // ── Fechas ──
  fechaInicioServicio?: string;
  fechaFinServicio?: string;

  // ── Estado ──
  estado: EstadoPedido;
  historialEstados: CambioEstado[];
  /** Fase actual + macro-estado + tramos con tiempos/actores — lo calcula el backend al leer, no se persiste. */
  timelineResumen?: TimelineResumen;

  createdAt: string;
  createdBy: string;
}

export type CreatePedidoInput = Omit<
  Pedido,
  | 'id'
  | 'code'
  | 'estado'
  | 'historialEstados'
  | 'timelineResumen'
  | 'createdAt'
  | 'lastSyncedAt'
  | 'as2Ref'
  | 'itemEstimado'
  // El nombre del Técnico HSE lo resuelve el backend contra el usuario real (FACT-001) — el cliente sólo manda el id.
  | 'tecnicoHseResponsableNombre'
>;

/** Líneas estimadas del Pedido, tolerante al shape viejo (`itemEstimado` única). */
export function itemsEstimadosDe(p: Pick<Pedido, 'itemsEstimados' | 'itemEstimado'>): ItemEstimado[] {
  if (p.itemsEstimados?.length) return p.itemsEstimados;
  return p.itemEstimado ? [p.itemEstimado] : [];
}

/** Primera línea estimada — la que usa la prefactura para el cargo de personal y la descripción por defecto. */
export function itemEstimadoPrincipal(p: Pick<Pedido, 'itemsEstimados' | 'itemEstimado'>): ItemEstimado | null {
  return itemsEstimadosDe(p)[0] ?? null;
}

/** Valor cotizado del Pedido (suma de todas las líneas) — base del reporte "cotizado vs. real". */
export function valorEstimadoPedido(p: Pick<Pedido, 'itemsEstimados' | 'itemEstimado'>): number {
  const total = itemsEstimadosDe(p).reduce((s, i) => s + i.cantidad * i.valorUnitario, 0);
  return Math.round(total * 100) / 100;
}
