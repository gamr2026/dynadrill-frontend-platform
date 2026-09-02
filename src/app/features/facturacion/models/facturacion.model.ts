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

/** 'borrador' = registrada en el Portal, sin activar. 'aprobada' = ACTIVADA (FACT-001, Fase 3) — visible/distribuida al resto de áreas. */
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
  /** FACT-001 — información complementaria que AS2 no gestiona. */
  fechaInicioEstimada?: string;
  fechaFinEstimada?: string;
  supervisorOperativo?: string;
  tecnicoHse?: string;
  /** FACT-001, Fase 2 — nombres de archivo simulados (presupuesto firmado, alcance/contrato marco). Sin almacenamiento real de binarios todavía. */
  documentosAdjuntos?: string[];
  /** FACT-001, Fase 3 — quién activó la OTQ y cuándo. */
  activadaPor?: string;
  activadaAt?: string;
  /** FACT-003, Escenario B — "el Ticket original se archiva como Versión 1.0, el actualizado como Versión 2.0". Empieza en 1; cada cambio de alcance aplicado la incrementa y archiva la versión anterior. */
  version: number;
  historialVersiones?: OtqVersion[];
}

/** Snapshot de una versión anterior de la OTQ, archivada al aplicar un cambio de alcance — FACT-003 "Control de Versiones". */
export interface OtqVersion {
  version: number;
  items: OtqItem[];
  motivo: string;
  fecha: string;
}

/** `numero` lo asigna el backend (mock) al crear — `OTQ-<año>-<pedido>` — no lo teclea el usuario. */
export type CreateOtqInput = Omit<Otq, 'id' | 'numero' | 'estado' | 'createdAt' | 'activadaPor' | 'activadaAt' | 'version' | 'historialVersiones'>;

export type OtqItemDraft = Omit<OtqItem, 'id' | 'total'>;

export function otqTotal(otq: Otq): number {
  return otq.items.reduce((sum, i) => sum + i.total, 0);
}

// ── Simulación de AS2 (FACT-001) — hasta que exista el API key real, el
// Portal Interno consulta este "espejo" en vez del sistema externo. La
// forma de los datos (pedido anclado a un contrato + lista de precios +
// responsables ya asignados) es deliberadamente la misma que tendría la
// respuesta real, para que el día que se conecte la API solo cambie el
// origen del dato, no las pantallas que lo consumen. ──

export interface As2PedidoInfo {
  pedidoId: number;
  cliente: string;
  numeroContrato: string;
  campo: string;
  bloque: string;
  pozo: string;
  taladro?: string;
  /** Ya asignados en AS2 — el Portal Interno los muestra, no los define. */
  supervisorOperativo: string;
  tecnicoHse: string;
}

export interface As2CatalogoItem {
  codigo: string;
  descripcion: string;
  unidad: string;
  tarifaUnitaria: number;
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
  /** Nº de serie de la herramienta despachada — obligatorio para herramientas en renta, opcional para servicios/consumibles. Se arrastra a la Prefactura y al Ticket. */
  serie?: string;
}

/** 'pendiente_supervisor' — recién registrada, esperando revisión y firma del Supervisor de Campo (FACT-002, Fase 1) antes de llegar a la cola de Facturación. */
export type DocumentacionEstado = 'pendiente_supervisor' | 'pendiente' | 'homologado' | 'rechazado';

export interface DocumentacionDiaria {
  id: number;
  pedidoId: number;
  fecha: string;
  hojasTiempo: HojaTiempoEntry[];
  usoEquipos: UsoEquipoEntry[];
  consumoMateriales: ConsumoMaterialEntry[];
  /** Ítems ya homologados (código/unidad/tarifa validados contra la OTQ) — lo que realmente alimenta la Prefactura. */
  items: DocumentacionItem[];
  /** FACT-002 — evidencia fotográfica del día (mínimo 3 por trabajo principal según el documento). Solo nombres de archivo simulados, sin almacenamiento real todavía. */
  fotos?: string[];
  estado: DocumentacionEstado;
  /** FACT-002, Fase 1 — "Supervisor: Revisa Documentación Antes de Enviar" + "Firmar Documentación". */
  firmaSupervisor?: Firma;
  observacionesHomologacion?: string;
  registradoPor: string;
  /** Momento real de registro (no confundir con `fecha`, que es el día operativo reportado) — de aquí sale la antigüedad "> 48h sin homologar" de FACT-002. */
  registradoAt: string;
  homologadoPor?: string;
  homologadoAt?: string;
}

/** FACT-002 — "Indicador de antigüedad (doc con > 48 hrs sin homologar se marca rojo)". */
export function documentacionVencida(doc: DocumentacionDiaria): boolean {
  if (doc.estado === 'homologado' || doc.estado === 'rechazado') return false;
  const horas = (Date.now() - new Date(doc.registradoAt).getTime()) / (1000 * 60 * 60);
  return horas > 48;
}

export type CreateDocumentacionDiariaInput = Pick<
  DocumentacionDiaria,
  'pedidoId' | 'fecha' | 'hojasTiempo' | 'usoEquipos' | 'consumoMateriales' | 'items' | 'registradoPor' | 'fotos'
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
  /** Nº de serie de la herramienta despachada — la GUÍA real lista un serial por línea. */
  serie?: string;
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
  /** Nº(s) de serie de la(s) herramienta(s) de esta línea — consolidado desde la documentación diaria homologada. */
  serie?: string;
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
  /** FACT-004 — IVA 15% y retenciones aplicadas por el cliente (IR 1%, IVA 30%). */
  iva: number;
  retencionIR: number;
  retencionIVA: number;
  netoCobrar: number;
  estado: FacturacionTicketEstado;
  firmaAutorizadoDynadrill?: Firma;
  firmaCompanyMan?: CompanyMan & { firmadoAt: string };
  fechaCierre: string;
  /** Placeholder — se completa cuando exista la integración real de emisión con AS2. */
  facturaAs2Ref?: string;
}

export type CreateFacturacionTicketInput = Pick<FacturacionTicket, 'pedidoId' | 'otqId' | 'items'>;

/** IVA vigente en Ecuador desde 2024 (antes 12%). */
const IVA_RATE = 0.15;
const RETENCION_IR_RATE = 0.01;
/** Retención de IVA — 30% es lo usual para servicios entre contribuyentes especiales (mismo % usado en la plantilla real de FACT-004). */
const RETENCION_IVA_RATE = 0.3;

export function ticketSubtotales(
  items: TicketItem[],
): { servicios: number; materiales: number; subtotal: number; iva: number; retencionIR: number; retencionIVA: number; netoCobrar: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const servicios = items.filter(i => i.tipo === 'Servicio').reduce((sum, i) => sum + i.precioTotal, 0);
  const materiales = items.filter(i => i.tipo === 'Material').reduce((sum, i) => sum + i.precioTotal, 0);
  const subtotal = servicios + materiales;
  const iva = round2(subtotal * IVA_RATE);
  const retencionIR = round2(subtotal * RETENCION_IR_RATE);
  const retencionIVA = round2(iva * RETENCION_IVA_RATE);
  const netoCobrar = round2(subtotal + iva - retencionIR - retencionIVA);
  return { servicios, materiales, subtotal, iva, retencionIR, retencionIVA, netoCobrar };
}

/**
 * Cierre habilitado solo con: acta firmada por ambas partes, al menos un
 * día de documentación homologada, y — FACT-004, Validación 1 ("Si Total
 * > Presupuesto → NO FACTURAR, activar FACT-003") — sin sobrepaso de
 * presupuesto sin resolver. Si está sobrepasado, se exige que exista una
 * Excepción de tipo 'sobrepaso' ya aprobada para ese pedido antes de
 * dejar generar el Ticket.
 */
export function pedidoListoParaCierre(
  acta: ActaEntregaRecepcion | undefined,
  documentacion: DocumentacionDiaria[],
  pedidoId: number,
  prefactura: Prefactura | null,
  excepciones: Excepcion[],
): boolean {
  return motivoNoListoParaCierre(acta, documentacion, pedidoId, prefactura, excepciones) === null;
}

/** Igual criterio que pedidoListoParaCierre(), pero devuelve por qué no está listo — para mostrarlo en pantalla. */
export function motivoNoListoParaCierre(
  acta: ActaEntregaRecepcion | undefined,
  documentacion: DocumentacionDiaria[],
  pedidoId: number,
  prefactura: Prefactura | null,
  excepciones: Excepcion[],
): string | null {
  const actaCompleta = !!acta?.firmaSupervisor && !!acta?.firmaCompanyMan;
  const docsDelPedido = documentacion.filter(d => d.pedidoId === pedidoId);
  const tieneHomologacion = docsDelPedido.some(d => d.estado === 'homologado');
  const sobrepasado = (prefactura?.porcentajeConsumido ?? 0) > 100;
  const excepcionAprobada = excepciones.some(e => e.pedidoId === pedidoId && e.tipo === 'sobrepaso' && e.estado === 'aprobada');
  // FACT-004, Validación 3 ("Respaldos Completos") — nada de documentación diaria puede quedar a medias antes de facturar.
  const hayDocsSinResolver = docsDelPedido.some(d => d.estado === 'pendiente_supervisor' || d.estado === 'pendiente');

  if (!actaCompleta && !tieneHomologacion) return 'Falta el acta firmada por ambas partes y al menos un día de documentación homologada.';
  if (!actaCompleta) return 'Falta el acta firmada por ambas partes.';
  if (!tieneHomologacion) return 'Falta al menos un día de documentación homologada.';
  if (hayDocsSinResolver) return 'Hay documentación diaria sin resolver (pendiente de firma del supervisor u homologación) — resuélvela antes de cerrar.';
  if (sobrepasado && !excepcionAprobada) return 'El acumulado supera el presupuesto aprobado — se necesita una excepción de sobrepaso aprobada antes de cerrar (FACT-003).';
  return null;
}
