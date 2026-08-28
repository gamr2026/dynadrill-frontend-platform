/**
 * Módulo Facturación — opera sobre un Pedido ya existente de Pumping
 * (`PumpingTicket`, referenciado acá por `pedidoId`) sin tocar ese modelo.
 *
 * Vocabulario importante, confirmado con el cliente: lo que el código de
 * Pumping llama "Ticket" es en realidad el Pedido del negocio — nace
 * vinculado a AS2, se ejecuta en campo. El "Ticket" de Facturación es una
 * entidad NUEVA y distinta, que nace una sola vez (1 Pedido → 1 Ticket) al
 * cerrar un Pedido ya trabajado, con su Prefactura consolidada. No se
 * renombra `PumpingTicket` — se documenta la distinción acá.
 *
 * Todo lo que en producción vendría de AS2 (Cliente, Lista de Precios,
 * Pedido Cliente, Despacho Cliente/Guía de Remisión, emisión de Factura o
 * Nota de Crédito) queda mockeado por ahora — se conecta cuando exista
 * backend + API key. La emisión electrónica ante el SRI nunca es trabajo
 * de este módulo: AS2 ya la resuelve.
 */

/** Firma "una línea" — mismo patrón que ya usa QHSE, sin captura manuscrita. */
export interface Firma {
  nombre: string;
  firmadoAt: string;
}

/** Representante del cliente en sitio — aparece repetido en OTQ/Ticket/Reporte Job/Guía; se modela una sola vez. */
export interface CompanyMan {
  nombre: string;
  cedula: string;
  cargo: string;
}

// ── OTQ (Orden de Trabajo) — la cotización inicial, con cantidades ESTIMADAS ──

export interface OtqItem {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  tarifaUnitaria: number;
  cantidadEstimada: number;
  total: number;
}

export type OtqEstado = 'borrador' | 'aprobada';

export interface Otq {
  id: number;
  numero: string;
  pedidoId: number;
  cliente: string;
  numeroContrato: string;
  campo: string;
  bloque: string;
  pozo: string;
  taladro?: string;
  items: OtqItem[];
  representanteLegal?: string;
  estado: OtqEstado;
  createdAt: string;
}

export type CreateOtqInput = Omit<Otq, 'id' | 'estado' | 'createdAt'>;

export function otqTotal(otq: Otq): number {
  return otq.items.reduce((sum, i) => sum + i.total, 0);
}

// ── Documentación diaria (FACT-002) — homologación → alimenta la Prefactura ──

export interface HojaTiempoEntry {
  nombre: string;
  cargo: string;
  horasNormales: number;
  horasExtras: number;
  horasNocturnas: number;
}

export interface UsoEquipoEntry {
  /** Referencia real a Unidad (Mantenimiento) — no texto libre. */
  unidadId: number;
  unidadCode: string;
  horometroInicial: number;
  horometroFinal: number;
  combustibleConsumido?: number;
  operador: string;
}

export interface ConsumoMaterialEntry {
  /** Referencia real a Articulo (Inventario) cuando existe en catálogo; código libre si es un ítem de la OTQ sin match en Inventario. */
  articuloId?: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

export interface DocumentacionItem {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  tipo: 'Material' | 'Servicio';
}

export type DocumentacionEstado = 'pendiente' | 'homologado' | 'rechazado';

export interface DocumentacionDiaria {
  id: number;
  pedidoId: number;
  fecha: string;
  hojasTiempo: HojaTiempoEntry[];
  usoEquipos: UsoEquipoEntry[];
  consumoMateriales: ConsumoMaterialEntry[];
  /** Ítems ya homologados (código/unidad/tarifa validados contra la OTQ) — lo que realmente alimenta la Prefactura. */
  items: DocumentacionItem[];
  estado: DocumentacionEstado;
  observacionesHomologacion?: string;
  registradoPor: string;
  homologadoPor?: string;
  homologadoAt?: string;
}

export type CreateDocumentacionDiariaInput = Pick<
  DocumentacionDiaria,
  'pedidoId' | 'fecha' | 'hojasTiempo' | 'usoEquipos' | 'consumoMateriales' | 'items' | 'registradoPor'
>;

// ── Prefactura — NO se persiste directo, se calcula sumando documentación homologada ──

export interface PrefacturaDia {
  fecha: string;
  subtotal: number;
  items: DocumentacionItem[];
}

export interface Prefactura {
  pedidoId: number;
  presupuestoAprobado: number;
  dias: PrefacturaDia[];
  acumulado: number;
  porcentajeConsumido: number;
}

/**
 * Deriva la Prefactura de un pedido sumando su documentación homologada —
 * igual criterio que calcularAlertas() en Mantenimiento: nunca se edita a
 * mano. El precio unitario vive en la OTQ (por código), no en la
 * documentación diaria, así que se resuelve acá cruzando ambas fuentes.
 */
export function calcularPrefactura(
  pedidoId: number,
  presupuestoAprobado: number,
  documentacion: DocumentacionDiaria[],
  otqItems: OtqItem[],
): Prefactura {
  const tarifaPorCodigo = new Map(otqItems.map(i => [i.codigo, i.tarifaUnitaria]));
  const homologados = documentacion.filter(d => d.pedidoId === pedidoId && d.estado === 'homologado');

  const dias: PrefacturaDia[] = homologados
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => {
      const subtotal = d.items.reduce((sum, item) => sum + item.cantidad * (tarifaPorCodigo.get(item.codigo) ?? 0), 0);
      return { fecha: d.fecha, items: d.items, subtotal };
    });

  const acumulado = dias.reduce((sum, d) => sum + d.subtotal, 0);
  return {
    pedidoId,
    presupuestoAprobado,
    dias,
    acumulado,
    porcentajeConsumido: presupuestoAprobado > 0 ? Math.round((acumulado / presupuestoAprobado) * 100) : 0,
  };
}

// ── Excepciones (FACT-003) ──

export type ExcepcionTipo = 'sobrepaso' | 'cambio_alcance';
export type ExcepcionEstado = 'en_negociacion' | 'aprobada' | 'rechazada';

export interface Excepcion {
  id: number;
  pedidoId: number;
  tipo: ExcepcionTipo;
  estado: ExcepcionEstado;
  montoExcedente?: number;
  descripcionCambio?: string;
  aprobacionClienteAt?: string;
  aprobacionGerenciaAt?: string;
  justificacion?: string;
  createdAt: string;
}

export type CreateExcepcionInput = Pick<Excepcion, 'pedidoId' | 'tipo' | 'montoExcedente' | 'descripcionCambio' | 'justificacion'>;

// ── Guía de campo — evidencia de despacho en sitio. NO es la Guía de Remisión SRI de AS2: se referencia, no se reemplaza. ──

export interface GuiaCampoItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  tipo: 'Material' | 'Servicio';
}

export interface GuiaCampo {
  id: number;
  pedidoId: number;
  cliente: string;
  campo: string;
  pozo: string;
  fecha: string;
  /** Referencia real a Unidad (Mantenimiento) — no placa a mano. */
  unidadId: number;
  unidadCode: string;
  items: GuiaCampoItem[];
  firmaCompanyMan?: CompanyMan & { firmadoAt: string };
  firmaDynadrill?: Firma;
  /** Número/estado de la Guía de Remisión real, una vez que AS2 la emite — vacío hasta que exista esa integración. */
  guiaRemisionAs2Ref?: string;
}

export type CreateGuiaCampoInput = Omit<GuiaCampo, 'id' | 'firmaCompanyMan' | 'firmaDynadrill' | 'guiaRemisionAs2Ref'>;

// ── Acta de Entrega-Recepción (requisito de cierre, FACT-004) ──

export interface ActaEntregaRecepcion {
  id: number;
  pedidoId: number;
  trabajosRealizados: string;
  fechaInicio: string;
  fechaFin: string;
  firmaSupervisor?: Firma;
  firmaCompanyMan?: CompanyMan & { firmadoAt: string };
}

export type CreateActaEntregaInput = Pick<ActaEntregaRecepcion, 'pedidoId' | 'trabajosRealizados' | 'fechaInicio' | 'fechaFin'>;

// ── Ticket (Facturación) — el cierre. Nace UNA vez por Pedido, con cantidades REALES. ──

export interface TicketItem {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  tipo: 'Material' | 'Servicio';
}

export type FacturacionTicketEstado = 'cerrado' | 'facturado';

export interface FacturacionTicket {
  id: number;
  code: string;
  pedidoId: number;
  otqId: number;
  items: TicketItem[];
  subtotalServicios: number;
  subtotalMateriales: number;
  subtotal: number;
  estado: FacturacionTicketEstado;
  firmaAutorizadoDynadrill?: Firma;
  firmaCompanyMan?: CompanyMan & { firmadoAt: string };
  fechaCierre: string;
  /** Placeholder — se completa cuando exista la integración real de emisión con AS2. */
  facturaAs2Ref?: string;
}

export type CreateFacturacionTicketInput = Pick<FacturacionTicket, 'pedidoId' | 'otqId' | 'items'>;

export function ticketSubtotales(items: TicketItem[]): { servicios: number; materiales: number; subtotal: number } {
  const servicios = items.filter(i => i.tipo === 'Servicio').reduce((sum, i) => sum + i.precioTotal, 0);
  const materiales = items.filter(i => i.tipo === 'Material').reduce((sum, i) => sum + i.precioTotal, 0);
  return { servicios, materiales, subtotal: servicios + materiales };
}

/** Cierre habilitado solo con acta firmada por ambas partes y al menos un día de documentación homologada — mismo criterio de "no facturar sin respaldo" de FACT-004. */
export function pedidoListoParaCierre(acta: ActaEntregaRecepcion | undefined, documentacion: DocumentacionDiaria[], pedidoId: number): boolean {
  const actaCompleta = !!acta?.firmaSupervisor && !!acta?.firmaCompanyMan;
  const tieneHomologacion = documentacion.some(d => d.pedidoId === pedidoId && d.estado === 'homologado');
  return actaCompleta && tieneHomologacion;
}
