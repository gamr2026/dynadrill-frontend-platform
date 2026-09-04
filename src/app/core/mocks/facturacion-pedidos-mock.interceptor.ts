import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import {
  CambioEstado,
  CreatePedidoInput,
  EstadoPedido,
  Pedido,
} from '../../features/facturacion/models/pedido.model';
import {
  CreateListaPreciosInput,
  ListaPrecios,
  ListaPreciosItemDraft,
} from '../../features/facturacion/models/lista-precios.model';
import {
  AvanceDocumental,
  DocumentoOperativo,
  PushDocumentoOperativoInput,
} from '../../features/facturacion/models/documento-operativo.model';
import {
  DocParaPrefactura,
  Prefactura,
  armarPrefacturaItems,
  prefacturaSubtotales,
} from '../../features/facturacion/models/prefactura.model';
import { GuiaRemision } from '../../features/facturacion/models/guia-remision.model';
import { Aot, aotValorOt } from '../../features/facturacion/models/aot.model';
import { crearTicketFcrParaPedido } from './fcr-mock.interceptor';

/** Líneas de servicio que se ejecutan y reportan desde el módulo FCR (Pumping tiene su propio módulo). */
const LINEAS_FCR = new Set(['ctu', 'fishing', 'completion']);

/**
 * Fase 0 — Mock de la reescritura del módulo de Facturación (Pedido + Lista
 * de Precios). Convive con `facturacion-mock.interceptor.ts` (endpoints
 * antiguos OTQ-céntricos) hasta que la Fase 0.3 reemplace las pantallas y
 * borre lo viejo.
 *
 * El **gateway AS2** es bidireccional y simulado: hay una sola lista de
 * pedidos; los que nacen en el Portal se marcan `origen: 'portal'` y los
 * sembrados imitan haber llegado de AS2 (`origen: 'as2'`). El número
 * secuencial lo asigna este gateway (en real lo posee AS2).
 */

// ── Semilla de Pedidos — datos verosímiles del Secuencial Tk Control ──

let pedidos: Pedido[] = [
  {
    id: 1,
    code: '4313',
    origen: 'as2',
    as2Ref: 'AS2-PED-4313',
    lastSyncedAt: '2026-08-18T08:00:00.000Z',
    cliente: 'EP Petroecuador',
    clienteRuc: '1768153530001',
    lineaServicio: 'ctu',
    campo: 'SACHA',
    bloque: '15',
    pozo: 'JVNA-001',
    taladroRig: 'RIGLESS',
    numeroContrato: '2025201',
    agenteComercial: 'Carla Yépez',
    representanteCampo: 'Ing. Víctor Sogso',
    representanteQuito: 'Lorena Zapata',
    analistaFacturacion: 'Ricardo',
    condicionPago: '30 días',
    zona: 'Zona Centro',
    bodega: 'BODEGA ORION',
    itemEstimado: { codigo: 'CT5104', descripcion: 'Cargo básico primeras 8 horas unidad de tubería continua', unidad: 'unidad', cantidad: 1, valorUnitario: 2845.05 },
    fechaInicioServicio: '2026-08-18',
    fechaFinServicio: '2026-08-19',
    estado: 'en_elaboracion_operativa',
    historialEstados: [
      { estado: 'abierto', fecha: '2026-08-15T08:00:00.000Z', usuario: 'Carla Yépez' },
      { estado: 'en_operacion', fecha: '2026-08-18T06:00:00.000Z', usuario: 'Sistema' },
      { estado: 'en_elaboracion_operativa', fecha: '2026-08-19T18:00:00.000Z', usuario: 'Sistema' },
    ],
    createdAt: '2026-08-15T08:00:00.000Z',
    createdBy: 'Carla Yépez',
  },
  {
    id: 2,
    code: '4308',
    origen: 'as2',
    as2Ref: 'AS2-PED-4308',
    lastSyncedAt: '2026-08-14T08:00:00.000Z',
    cliente: 'EP Petroecuador',
    clienteRuc: '1768153530001',
    lineaServicio: 'fishing',
    campo: 'SACHA',
    bloque: '60',
    pozo: 'SCH-116',
    taladroRig: 'TRIBOILGAS-104',
    numeroContrato: '2025201',
    agenteComercial: 'Carlos Castro',
    representanteCampo: 'Ing. Paúl Ñacato',
    representanteQuito: 'Juan Palomino',
    analistaFacturacion: 'Ilda',
    condicionPago: '30 días',
    zona: 'Zona Centro',
    bodega: 'BODEGA ORION',
    itemEstimado: { codigo: 'SFS6057', descripcion: 'Subs - rotary, bit sub, crossover sub hasta conexión 4 1/2"', unidad: 'día', cantidad: 3, valorUnitario: 91.84 },
    fechaInicioServicio: '2026-08-13',
    fechaFinServicio: '2026-08-14',
    estado: 'en_operacion',
    historialEstados: [
      { estado: 'abierto', fecha: '2026-08-12T08:00:00.000Z', usuario: 'Carlos Castro' },
      { estado: 'en_operacion', fecha: '2026-08-13T06:00:00.000Z', usuario: 'Sistema' },
    ],
    createdAt: '2026-08-12T08:00:00.000Z',
    createdBy: 'Carlos Castro',
  },
  {
    id: 3,
    code: '4311',
    origen: 'as2',
    as2Ref: 'AS2-PED-4311',
    lastSyncedAt: '2026-08-20T08:00:00.000Z',
    cliente: 'EP Petroecuador',
    clienteRuc: '1768153530001',
    lineaServicio: 'completion',
    campo: 'AUCA',
    bloque: '56',
    pozo: 'GNTC-017',
    taladroRig: 'TITAN-125',
    numeroContrato: '2025201',
    agenteComercial: 'Elsa',
    representanteCampo: 'Ing. Kevin Guevara',
    representanteQuito: 'Luis Obando',
    analistaFacturacion: 'Elsa',
    condicionPago: '30 días',
    zona: 'Zona Centro',
    bodega: 'BODEGA ORION',
    itemEstimado: { codigo: 'SCR5001', descripcion: 'Supervisor para completaciones, remediación día o fracción', unidad: 'día', cantidad: 4, valorUnitario: 437.23 },
    fechaInicioServicio: '2026-07-17',
    fechaFinServicio: '2026-07-20',
    estado: 'documentos_completos',
    historialEstados: [
      { estado: 'abierto', fecha: '2026-07-15T08:00:00.000Z', usuario: 'Elsa' },
      { estado: 'en_operacion', fecha: '2026-07-17T06:00:00.000Z', usuario: 'Sistema' },
      { estado: 'en_elaboracion_operativa', fecha: '2026-07-20T18:00:00.000Z', usuario: 'Sistema' },
      { estado: 'documentos_completos', fecha: '2026-07-22T10:00:00.000Z', usuario: 'Sistema' },
    ],
    createdAt: '2026-07-15T08:00:00.000Z',
    createdBy: 'Elsa',
  },
  {
    id: 4,
    code: '4304',
    origen: 'as2',
    as2Ref: 'AS2-PED-4304',
    lastSyncedAt: '2026-07-20T08:00:00.000Z',
    cliente: 'EP Petroecuador',
    clienteRuc: '1768153530001',
    lineaServicio: 'pumping',
    campo: 'SACHA',
    bloque: '60',
    pozo: 'SCH-116',
    taladroRig: 'TRIBOILGAS-104',
    numeroContrato: '2025201',
    agenteComercial: 'Verónica Romero',
    representanteCampo: 'Ing. Jorge Corella',
    representanteQuito: 'Andrea Chamba',
    analistaFacturacion: 'Elsa',
    condicionPago: '30 días',
    zona: 'Zona Centro',
    bodega: 'BODEGA ORION',
    itemEstimado: { codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', cantidad: 2, valorUnitario: 437.23 },
    fechaInicioServicio: '2026-07-16',
    fechaFinServicio: '2026-07-19',
    estado: 'ticket_firmado',
    historialEstados: [
      { estado: 'abierto', fecha: '2026-07-14T08:00:00.000Z', usuario: 'Verónica Romero' },
      { estado: 'en_operacion', fecha: '2026-07-16T06:00:00.000Z', usuario: 'Sistema' },
      { estado: 'documentos_completos', fecha: '2026-07-20T09:00:00.000Z', usuario: 'Sistema' },
      { estado: 'prefactura_generada', fecha: '2026-07-22T11:00:00.000Z', usuario: 'Ilda' },
      { estado: 'enviado_para_firmas', fecha: '2026-07-22T15:00:00.000Z', usuario: 'Ilda' },
      { estado: 'ticket_firmado', fecha: '2026-07-25T10:00:00.000Z', usuario: 'Cliente' },
    ],
    createdAt: '2026-07-14T08:00:00.000Z',
    createdBy: 'Verónica Romero',
  },
];

let nextPedidoId = 5;
/** Secuencial de pedido/ticket — en real lo posee AS2. */
let nextPedidoCode = 4318;

/** Avanza el estado de un Pedido y registra el cambio en su historial. */
function avanzarPedido(pedidoId: number, estado: EstadoPedido, usuario: string, motivo?: string): void {
  const now = new Date().toISOString();
  pedidos = pedidos.map(p =>
    p.id === pedidoId
      ? { ...p, estado, historialEstados: [...p.historialEstados, { estado, fecha: now, usuario, motivo }] }
      : p,
  );
}

/**
 * Cola de pedidos "creados en AS2" que todavía no se han sincronizado al
 * Portal. Cada `POST /pedidos/sync-as2` baja uno — demuestra la
 * bidireccionalidad: lo que se registra del lado de AS2 aparece acá.
 */
let pedidosPendientesAs2: Omit<Pedido, 'id' | 'code' | 'lastSyncedAt'>[] = [
  {
    origen: 'as2',
    as2Ref: 'AS2-PED-NUEVO-1',
    cliente: 'EP Petroecuador',
    clienteRuc: '1768153530001',
    lineaServicio: 'pumping',
    campo: 'AUCA',
    bloque: '57',
    pozo: 'ACA-045',
    taladroRig: 'TRIBOILGAS-101',
    numeroContrato: '2025201',
    agenteComercial: 'Nilo Morales',
    representanteCampo: 'Ing. José Velásquez',
    representanteQuito: 'Juan Palomino',
    condicionPago: '30 días',
    zona: 'Zona Centro',
    bodega: 'BODEGA ORION',
    itemEstimado: { codigo: 'SB3208', descripcion: 'Bombeo de ácido primeros 2.000 galones', unidad: 'gls', cantidad: 2000, valorUnitario: 0.33 },
    estado: 'abierto',
    historialEstados: [{ estado: 'abierto', fecha: new Date().toISOString(), usuario: 'Nilo Morales (AS2)' }],
    createdAt: new Date().toISOString(),
    createdBy: 'Nilo Morales (AS2)',
  },
];

// ── Semilla de Listas de Precios ──

let listasPrecios: ListaPrecios[] = [
  {
    id: 1,
    cliente: 'EP Petroecuador',
    numeroContrato: '2025201',
    vigenteDesde: '2025-01-01',
    activa: true,
    items: [
      { id: 1, codigo: 'SB3201', descripcion: 'Viaje por unidad de bombeo para estimulación', unidad: 'km', precio: 3.15, tipo: 'Servicio' },
      { id: 2, codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', precio: 437.23, tipo: 'Servicio' },
      { id: 3, codigo: 'SB3227', descripcion: 'Operador para estimulación día o fracción', unidad: 'día', precio: 349.78, tipo: 'Servicio' },
      { id: 4, codigo: 'SB3208', descripcion: 'Bombeo de ácido primeros 2.000 galones', unidad: 'gls', precio: 0.33, tipo: 'Servicio' },
      { id: 5, codigo: 'CT5104', descripcion: 'Cargo básico primeras 8 horas unidad de tubería continua', unidad: 'unidad', precio: 2845.05, tipo: 'Servicio' },
      { id: 6, codigo: 'CT5134', descripcion: 'Supervisor Coiled Tubing día o fracción', unidad: 'día', precio: 806.54, tipo: 'Servicio' },
      { id: 7, codigo: 'SFS6057', descripcion: 'Subs - rotary, bit sub, crossover sub hasta conexión 4 1/2"', unidad: 'día', precio: 91.84, tipo: 'Servicio' },
      { id: 8, codigo: 'SCR5001', descripcion: 'Supervisor para completaciones, remediación día o fracción', unidad: 'día', precio: 437.23, tipo: 'Servicio' },
      { id: 9, codigo: 'SH2075', descripcion: 'Centralizadores', unidad: 'día', precio: 692.73, tipo: 'Servicio' },
      { id: 10, codigo: 'DYEF6067', descripcion: 'Act model BKR premium cement retainer - wireline set / drillable', unidad: 'unidad', precio: 1349.12, tipo: 'Material' },
      { id: 11, codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', unidad: 'bbl', precio: 34.9, tipo: 'Material' },
      { id: 12, codigo: 'QP21301', descripcion: 'Dispersante de parafinas crudos livianos', unidad: 'gls', precio: 33.29, tipo: 'Material' },
    ],
  },
];

let nextListaId = 2;
let nextListaItemId = 100;

// ── Documentos operativos recibidos desde FCR / Pumping (Fase 3) ──

const jobDia = (fecha: string, filas: [string, string, string, number, string][]): DocumentoOperativo['actividades'] =>
  filas.map(([inicio, fin, detalle, horas, autor], i) => ({ id: i + 1, date: fecha, startTime: inicio, endTime: fin, durationHours: horas, detail: detalle, author: autor }));

let documentosOperativos: DocumentoOperativo[] = [
  // Pedido 1 (id 1) — CTU / JVNA-001, en elaboración: 2 días de Reporte Job + Reporte de Htas.
  // El Reporte de Htas ya registró una venta (Material) -> exige Guía de Remisión antes de poder prefacturar.
  {
    id: 1,
    pedidoId: 1,
    origen: 'fcr',
    ticketOperativoId: 3,
    tipo: 'reporte_job',
    fecha: '2026-08-18',
    estado: 'recibido',
    firmadoPor: 'José Luis Sáenz',
    firmadoAt: '2026-08-18T20:00:00.000Z',
    recibidoAt: '2026-08-18T20:05:00.000Z',
    header: { code: '4313', cliente: 'EP Petroecuador', pozo: 'JVNA-001', supervisor: 'José Luis Sáenz', operador: 'Carla Yépez' },
    actividades: jobDia('2026-08-18', [
      ['06:00', '14:00', 'Movilización y armado de unidad CTU en locación.', 8, 'José Luis Sáenz'],
    ]),
  },
  {
    id: 4,
    pedidoId: 1,
    origen: 'fcr',
    ticketOperativoId: 3,
    tipo: 'reporte_job',
    fecha: '2026-08-19',
    estado: 'recibido',
    firmadoPor: 'José Luis Sáenz',
    firmadoAt: '2026-08-19T20:00:00.000Z',
    recibidoAt: '2026-08-19T20:05:00.000Z',
    header: { code: '4313', cliente: 'EP Petroecuador', pozo: 'JVNA-001', supervisor: 'José Luis Sáenz', operador: 'Carla Yépez' },
    actividades: jobDia('2026-08-19', [
      ['06:00', '10:00', 'Armado de BHA de limpieza y prueba de unidad CTU.', 4, 'José Luis Sáenz'],
      ['10:00', '18:00', 'Corrida de CTU a profundidad, limpieza de punzados.', 8, 'José Luis Sáenz'],
    ]),
  },
  {
    id: 2,
    pedidoId: 1,
    origen: 'fcr',
    ticketOperativoId: 3,
    tipo: 'reporte_herramientas',
    estado: 'recibido',
    firmadoPor: 'José Luis Sáenz',
    firmadoAt: '2026-08-19T20:10:00.000Z',
    recibidoAt: '2026-08-19T20:12:00.000Z',
    header: { code: '4313', cliente: 'EP Petroecuador', pozo: 'JVNA-001', supervisor: 'José Luis Sáenz', operador: 'Carla Yépez' },
    herramientas: [
      { id: 1, name: 'Cargo básico unidad de tubería continua', serialCode: 'DY-CT-018', codigo: 'CT5104' },
      { id: 2, name: 'Supervisor Coiled Tubing', serialCode: 'DY-JT-204', codigo: 'CT5134' },
      { id: 3, name: 'Crossover sub / conector BHA', serialCode: 'DY-CN-091', codigo: 'SFS6057' },
    ],
    usoHerramientas: [
      { id: 1, toolId: 1, date: '2026-08-18', status: 'operacion' },
      { id: 2, toolId: 1, date: '2026-08-19', status: 'operacion' },
      { id: 3, toolId: 2, date: '2026-08-18', status: 'daily_charge' },
      { id: 4, toolId: 2, date: '2026-08-19', status: 'operacion' },
      { id: 5, toolId: 3, date: '2026-08-18', status: 'venta' },
    ],
  },
  // Pedido 3 (id 3) — Completion / GNTC-017, documentos completos: 3 días Job + Htas firmados.
  ...[0, 1, 2].map<DocumentoOperativo>(d => ({
    id: 10 + d,
    pedidoId: 3,
    origen: 'fcr',
    ticketOperativoId: 6,
    tipo: 'reporte_job',
    fecha: ['2026-07-17', '2026-07-18', '2026-07-19'][d],
    estado: 'recibido',
    firmadoPor: 'Alejandro Criollo',
    firmadoAt: `2026-07-${17 + d}T20:00:00.000Z`,
    recibidoAt: `2026-07-${17 + d}T20:05:00.000Z`,
    header: { code: '4311', cliente: 'EP Petroecuador', pozo: 'GNTC-017', supervisor: 'Alejandro Criollo', operador: 'Elsa' },
    actividades: jobDia(['2026-07-17', '2026-07-18', '2026-07-19'][d], [
      ['06:00', '12:00', 'Servicio de completación — bajada de packer y accesorios.', 6, 'Alejandro Criollo'],
      ['12:00', '18:00', 'Prueba de admisión y asentamiento.', 6, 'Alejandro Criollo'],
    ]),
  })),
  {
    id: 20,
    pedidoId: 3,
    origen: 'fcr',
    ticketOperativoId: 6,
    tipo: 'reporte_herramientas',
    estado: 'recibido',
    firmadoPor: 'Alejandro Criollo',
    firmadoAt: '2026-07-19T20:10:00.000Z',
    recibidoAt: '2026-07-19T20:15:00.000Z',
    header: { code: '4311', cliente: 'EP Petroecuador', pozo: 'GNTC-017', supervisor: 'Alejandro Criollo', operador: 'Elsa' },
    herramientas: [
      { id: 1, name: 'Supervisor para completaciones', serialCode: 'DY-RT-382', codigo: 'SCR5001' },
      { id: 2, name: 'Crossover / subs de completación', serialCode: 'DY-RT-544', codigo: 'SFS6057' },
      { id: 3, name: 'Centralizadores', serialCode: 'WT-MST-001', codigo: 'SH2075' },
    ],
    usoHerramientas: [
      { id: 1, toolId: 1, date: '2026-07-17', status: 'operacion' },
      { id: 2, toolId: 1, date: '2026-07-18', status: 'operacion' },
      { id: 3, toolId: 1, date: '2026-07-19', status: 'daily_charge' },
      { id: 4, toolId: 2, date: '2026-07-17', status: 'daily_charge' },
      { id: 5, toolId: 2, date: '2026-07-18', status: 'daily_charge' },
      { id: 6, toolId: 3, date: '2026-07-17', status: 'operacion' },
    ],
  },
  // Pedido 4 (id 4) — Pumping / SCH-116, ticket firmado: solo Reporte Job (Pumping no hace Htas.).
  ...[0, 1, 2].map<DocumentoOperativo>(d => ({
    id: 30 + d,
    pedidoId: 4,
    origen: 'pumping',
    ticketOperativoId: 3,
    tipo: 'reporte_job',
    fecha: ['2026-07-16', '2026-07-17', '2026-07-18'][d],
    estado: 'recibido',
    firmadoPor: 'Luis Auquilla',
    firmadoAt: `2026-07-${16 + d}T21:00:00.000Z`,
    recibidoAt: `2026-07-${16 + d}T21:05:00.000Z`,
    header: { code: '4304', cliente: 'EP Petroecuador', pozo: 'SCH-116', supervisor: 'Luis Auquilla', operador: 'Verónica Romero' },
    actividades: jobDia(['2026-07-16', '2026-07-17', '2026-07-18'][d], [
      ['05:00', '11:00', 'Armado de líneas y prueba de unidad de bombeo.', 6, 'Luis Auquilla'],
      ['11:00', '19:00', 'Bombeo de ácido y desplazamiento según programa.', 8, 'Luis Auquilla'],
    ]),
  })),
];

let nextDocOperativoId = 100;

// ── Prefacturas (Fase 4) ──

let prefacturas: Prefactura[] = [];
let nextPrefacturaId = 1;
let nextPrefacturaCode = 3800;

let guiasRemision: GuiaRemision[] = [];
let nextGuiaRemisionId = 1;

let aots: Aot[] = [];
let nextAotId = 1;
let nextNumeroOt = 692;

const CONTRATO_2025201_TEXTO =
  'CONTRATO 2025201 - SERVICIOS EVENTUALES BAJO LLAMADA DE APOYO A LAS OPERACIONES, SERVICIOS DE ESTIMULACIÓN Y ' +
  'LIMPIEZA DE POZOS, ACTIVIDADES RELACIONADAS CON LA PRODUCCIÓN, COMPLETACION INICIAL DE POZOS, RENTA DE ' +
  'HERRAMIENTAS DE REACONDICIONAMIENTO/COMPLETACIÓN Y PROVISIÓN DE INSUMOS Y MATERIALES PARA ACTIVIDADES DE ' +
  'CEMENTACIÓN Y TRATAMIENTO DE FLUIDOS ÚNICAMENTE PARA LA PRESTACIÓN DE SERVICIOS RELACIONADOS AL OBJETO DEL ' +
  'CONTRATO EN LOS CAMPOS DE EP PETROECUADOR INCLUIDO BLOQUE 6 (OFFSHORE)';

function construirAot(prefacturaId: number, ciudad: string, descripcionRequerimiento: string, repCliente: { nombre: string; cargo: string }): Aot | null {
  const pf = prefacturas.find(p => p.id === prefacturaId);
  if (!pf) return null;
  const pedido = pedidos.find(p => p.id === pf.pedidoId);
  if (!pedido) return null;
  const anio = new Date().getFullYear();
  const numeroOt = nextNumeroOt++;
  const detalle = pf.items.map(i => ({
    codigo: i.codigo,
    servicioRequerido: i.descripcion,
    unidad: i.unidad,
    tarifaUnitaria: i.precioUnitario,
    cantidad: i.cantidad,
    total: i.precioTotal,
  }));
  const inicio = pedido.fechaInicioServicio ? new Date(pedido.fechaInicioServicio) : new Date();
  const fechaMenosUno = new Date(inicio.getTime() - 86_400_000).toISOString().slice(0, 10);
  return {
    id: nextAotId++,
    pedidoId: pedido.id,
    prefacturaId,
    numeroOt,
    ciudad,
    numeroOpr: `${numeroOt}-OPR-${pedido.pozo}-${ciudad}-${anio}`,
    fecha: fechaMenosUno,
    numeroContrato: pedido.numeroContrato,
    contratoTexto: pedido.numeroContrato === '2025201' ? CONTRATO_2025201_TEXTO : `CONTRATO ${pedido.numeroContrato}`,
    descripcionRequerimiento,
    servicio: `${descripcionRequerimiento} /${pedido.pozo}/${pedido.taladroRig}`,
    fechaInicio: pedido.fechaInicioServicio ?? '',
    fechaTerminacion: pedido.fechaFinServicio ?? '',
    detalle,
    valorOt: aotValorOt(detalle),
    representanteContratista: { nombre: 'Ab. Mónica Rojas', cargo: 'Representante Legal' },
    representanteCliente: repCliente,
    estado: 'generada',
    generadaAt: new Date().toISOString(),
  };
}

function docsParaPrefactura(pedidoId: number): DocParaPrefactura[] {
  return documentosOperativos
    .filter(d => d.pedidoId === pedidoId)
    .map(d => ({
      tipo: d.tipo,
      fechasJob: d.tipo === 'reporte_job' && d.fecha ? [d.fecha] : [],
      herramientas: d.herramientas,
      usoHerramientas: d.usoHerramientas,
    }));
}

function construirPrefactura(pedidoId: number, generadoPor?: string): Prefactura | null {
  const pedido = pedidos.find(p => p.id === pedidoId);
  if (!pedido) return null;
  const lista =
    listasPrecios.find(l => l.cliente === pedido.cliente && l.numeroContrato === pedido.numeroContrato && l.activa) ??
    listasPrecios.find(l => l.cliente === pedido.cliente && l.activa);
  const items = armarPrefacturaItems(pedido.itemEstimado.codigo, docsParaPrefactura(pedidoId), lista?.items ?? []);
  const s = prefacturaSubtotales(items);
  return {
    id: nextPrefacturaId++,
    code: `PF-2026-${String(nextPrefacturaCode++)}`,
    pedidoId,
    items,
    subtotalServicios: s.servicios,
    subtotalMateriales: s.materiales,
    subtotal: s.subtotal,
    iva: s.iva,
    retencionIR: s.retencionIR,
    retencionIVA: s.retencionIVA,
    netoCobrar: s.netoCobrar,
    estado: 'generada',
    fechaGeneracion: new Date().toISOString(),
    generadoPor,
  };
}

// Semilla: el Pedido 4 (ticket firmado) ya tiene su prefactura firmada.
(() => {
  const pf = construirPrefactura(4);
  if (pf) {
    pf.estado = 'firmada';
    pf.fechaGeneracion = '2026-07-22T11:00:00.000Z';
    pf.generadoPor = 'Ilda Zambrano';
    pf.envioCliente = { enviadoAt: '2026-07-22T15:00:00.000Z', medio: 'email', adjuntos: ['Prefactura PF-2026-3800.pdf', 'Reporte Job SCH-116.pdf'] };
    pf.firmaCliente = { nombre: 'Ing. Andrea Chamba', cargo: 'Ingeniero de Operaciones', firmadoAt: '2026-07-25T10:00:00.000Z' };
    prefacturas = [pf];
  }
})();

// Pedidos históricos ya facturados — dan cuerpo a la reportería (FACT-005).
(() => {
  const historicos: { pedido: Omit<Pedido, 'id'>; subtotal: number; servicios: number; materiales: number }[] = [
    {
      subtotal: 51464.21, servicios: 41464.21, materiales: 10000,
      pedido: {
        code: '4180', origen: 'as2', as2Ref: 'AS2-PED-4180', lastSyncedAt: '2026-01-20T08:00:00.000Z',
        cliente: 'EP Petroecuador', clienteRuc: '1768153530001', lineaServicio: 'ctu', campo: 'SACHA', bloque: '15', pozo: 'JVNA-001',
        taladroRig: 'RIGLESS', numeroContrato: '2025201', agenteComercial: 'Carla Yépez', representanteCampo: 'Ing. Víctor Sogso',
        representanteQuito: 'Lorena Zapata', analistaFacturacion: 'Ricardo', condicionPago: '30 días', zona: 'Zona Centro', bodega: 'BODEGA ORION',
        itemEstimado: { codigo: 'CT5104', descripcion: 'Cargo básico primeras 8 horas unidad de tubería continua', unidad: 'unidad', cantidad: 1, valorUnitario: 48000 },
        fechaInicioServicio: '2026-01-10', fechaFinServicio: '2026-01-14', estado: 'facturado',
        historialEstados: [{ estado: 'facturado', fecha: '2026-01-25T10:00:00.000Z', usuario: 'Sistema' }],
        createdAt: '2026-01-08T08:00:00.000Z', createdBy: 'Carla Yépez',
      },
    },
    {
      subtotal: 25947.62, servicios: 25947.62, materiales: 0,
      pedido: {
        code: '4205', origen: 'as2', as2Ref: 'AS2-PED-4205', lastSyncedAt: '2026-02-15T08:00:00.000Z',
        cliente: 'EP Petroecuador', clienteRuc: '1768153530001', lineaServicio: 'pumping', campo: 'GORDON', bloque: '61', pozo: 'GCLH-022',
        taladroRig: 'RIGLESS', numeroContrato: '2025201', agenteComercial: 'Verónica Romero', representanteCampo: 'Ing. Julio Quinga',
        representanteQuito: 'Mónica Quisnancela', analistaFacturacion: 'Elsa', condicionPago: '30 días', zona: 'Zona Centro', bodega: 'BODEGA ORION',
        itemEstimado: { codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', cantidad: 5, valorUnitario: 5000 },
        fechaInicioServicio: '2026-02-05', fechaFinServicio: '2026-02-09', estado: 'facturado',
        historialEstados: [{ estado: 'facturado', fecha: '2026-02-18T10:00:00.000Z', usuario: 'Sistema' }],
        createdAt: '2026-02-03T08:00:00.000Z', createdBy: 'Verónica Romero',
      },
    },
    {
      subtotal: 40938.38, servicios: 33436.4, materiales: 7501.98,
      pedido: {
        code: '4262', origen: 'as2', as2Ref: 'AS2-PED-4262', lastSyncedAt: '2026-03-12T08:00:00.000Z',
        cliente: 'Petroandina', clienteRuc: '1792060346001', lineaServicio: 'fishing', campo: 'PINDO', bloque: '57', pozo: 'SCH-061',
        taladroRig: 'TUSCANY-104', numeroContrato: '2025201', agenteComercial: 'Carlos Ortiz', representanteCampo: 'Ing. Segundo Tisalema',
        representanteQuito: 'Luis Peñaherrera', analistaFacturacion: 'Irvin', condicionPago: '45 días', zona: 'Zona Centro', bodega: 'BODEGA ORION',
        itemEstimado: { codigo: 'SFS6057', descripcion: 'Subs - rotary, bit sub, crossover sub', unidad: 'día', cantidad: 4, valorUnitario: 10000 },
        fechaInicioServicio: '2026-03-01', fechaFinServicio: '2026-03-05', estado: 'facturado',
        historialEstados: [{ estado: 'facturado', fecha: '2026-03-15T10:00:00.000Z', usuario: 'Sistema' }],
        createdAt: '2026-02-27T08:00:00.000Z', createdBy: 'Carlos Ortiz',
      },
    },
  ];
  for (const h of historicos) {
    const pedido: Pedido = { ...h.pedido, id: nextPedidoId++ };
    pedidos = [...pedidos, pedido];
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const iva = round2(h.subtotal * 0.15);
    prefacturas = [
      ...prefacturas,
      {
        id: nextPrefacturaId++,
        code: `PF-2026-${String(nextPrefacturaCode++)}`,
        pedidoId: pedido.id,
        items: [],
        subtotalServicios: h.servicios,
        subtotalMateriales: h.materiales,
        subtotal: h.subtotal,
        iva,
        retencionIR: round2(h.subtotal * 0.01),
        retencionIVA: round2(iva * 0.3),
        netoCobrar: round2(h.subtotal + iva - h.subtotal * 0.01 - iva * 0.3),
        estado: 'firmada',
        fechaGeneracion: pedido.historialEstados[0].fecha,
        generadoPor: pedido.analistaFacturacion,
        firmaCliente: { nombre: pedido.representanteQuito, cargo: 'Ingeniero de Operaciones', firmadoAt: pedido.historialEstados[0].fecha },
      },
    ];
  }
})();

function calcularAvance(pedidoId: number): AvanceDocumental {
  const pedido = pedidos.find(p => p.id === pedidoId);
  const docs = documentosOperativos.filter(d => d.pedidoId === pedidoId);
  const jobDias = new Set(docs.filter(d => d.tipo === 'reporte_job').map(d => d.fecha)).size;
  const aplicaHtas = pedido?.lineaServicio !== 'pumping';
  const htasRecibido = docs.some(d => d.tipo === 'reporte_herramientas' && d.estado === 'recibido');
  // Días esperados = días entre inicio y fin de servicio (aprox.).
  const diasEsperados =
    pedido?.fechaInicioServicio && pedido?.fechaFinServicio
      ? Math.max(1, Math.round((new Date(pedido.fechaFinServicio).getTime() - new Date(pedido.fechaInicioServicio).getTime()) / 86_400_000) + 1)
      : Math.max(1, jobDias);
  const hayVentas = docs.some(d => d.tipo === 'reporte_herramientas' && (d.usoHerramientas ?? []).some(u => u.status === 'venta'));
  const materialesRegistrados = hayVentas || !aplicaHtas;
  // La Guía de Remisión es requisito PREVIO a generar la prefactura cuando hay ítems Material (FACT-002/004).
  const guiaRemisionAplica = hayVentas;
  const guiaRemisionGenerada = guiasRemision.some(g => g.pedidoId === pedidoId);
  const completo = jobDias >= diasEsperados && (!aplicaHtas || htasRecibido) && (!guiaRemisionAplica || guiaRemisionGenerada);
  return {
    pedidoId,
    reporteJobDias: jobDias,
    reporteJobDiasEsperados: diasEsperados,
    reporteHerramientasAplica: aplicaHtas,
    reporteHerramientasAlDia: !aplicaHtas || htasRecibido,
    materialesRegistrados,
    guiaRemisionAplica,
    guiaRemisionGenerada,
    completo,
  };
}

// ── Helpers ──

function matchId(url: string, resource: string): number | null {
  // Solo "recurso/:id" terminal — no "recurso/:id/accion".
  const m = url.match(new RegExp(`/api/facturacion/${resource}/(\\d+)(?:$|\\?)`));
  return m ? Number(m[1]) : null;
}
function matchAction(url: string, resource: string, action: string): number | null {
  const m = url.match(new RegExp(`/api/facturacion/${resource}/(\\d+)/${action}`));
  return m ? Number(m[1]) : null;
}

export const facturacionPedidosMockInterceptor: HttpInterceptorFn = (req, next) => {
  // ── Pedidos ──
  if (req.url === '/api/facturacion/pedidos' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: pedidos })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/pedidos' && req.method === 'POST') {
    const input = req.body as CreatePedidoInput;
    const now = new Date().toISOString();
    const code = String(nextPedidoCode++);
    const created: Pedido = {
      ...input,
      id: nextPedidoId++,
      code,
      // Alta desde el Portal: el gateway lo "empuja" a AS2 y devuelve la referencia.
      as2Ref: `AS2-PED-${code}`,
      lastSyncedAt: now,
      estado: 'abierto',
      historialEstados: [{ estado: 'abierto', fecha: now, usuario: input.createdBy }],
      createdAt: now,
    };
    pedidos = [...pedidos, created];
    // Puente Facturación -> FCR: las líneas que se ejecutan por FCR generan de una vez su ticket
    // vinculado (por pedidoCode), listo para trabajar desde 'validacion' en el módulo operativo.
    if (LINEAS_FCR.has(created.lineaServicio)) {
      crearTicketFcrParaPedido({
        pedidoCode: created.code,
        cliente: created.cliente,
        pozo: created.pozo,
        estimatedDate: created.fechaInicioServicio || now.slice(0, 10),
      });
    }
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const pedidoId = matchId(req.url, 'pedidos');
  if (pedidoId !== null && req.method === 'GET') {
    const found = pedidos.find(p => p.id === pedidoId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(250));
  }
  const cambiarEstadoId = matchAction(req.url, 'pedidos', 'estado');
  if (cambiarEstadoId !== null && req.method === 'PATCH') {
    const { estado, usuario, motivo } = req.body as { estado: EstadoPedido; usuario: string; motivo?: string };
    let updated: Pedido | undefined;
    pedidos = pedidos.map(p => {
      if (p.id !== cambiarEstadoId) return p;
      const cambio: CambioEstado = { estado, fecha: new Date().toISOString(), usuario, motivo };
      updated = { ...p, estado, historialEstados: [...p.historialEstados, cambio] };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(350));
  }
  /**
   * Sincroniza con AS2 (bidireccional): baja el siguiente pedido que se
   * creó del lado de AS2 (si hay) y re-sella `lastSyncedAt` de todo lo que
   * vino de AS2.
   */
  if (req.url === '/api/facturacion/pedidos/sync-as2' && req.method === 'POST') {
    const now = new Date().toISOString();
    const pendiente = pedidosPendientesAs2.shift();
    if (pendiente) {
      const nuevo: Pedido = { ...pendiente, id: nextPedidoId++, code: String(nextPedidoCode++), lastSyncedAt: now };
      pedidos = [...pedidos, nuevo];
      if (LINEAS_FCR.has(nuevo.lineaServicio)) {
        crearTicketFcrParaPedido({
          pedidoCode: nuevo.code,
          cliente: nuevo.cliente,
          pozo: nuevo.pozo,
          estimatedDate: nuevo.fechaInicioServicio || now.slice(0, 10),
        });
      }
    }
    pedidos = pedidos.map(p => (p.origen === 'as2' ? { ...p, lastSyncedAt: now } : p));
    return of(new HttpResponse({ status: 200, body: { pedidos, nuevos: pendiente ? 1 : 0 } })).pipe(delay(500));
  }

  // ── Documentos operativos (recibidos de FCR / Pumping) ──
  if (req.url === '/api/facturacion/documentos-operativos' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: documentosOperativos })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/documentos-operativos' && req.method === 'POST') {
    const input = req.body as PushDocumentoOperativoInput;
    const pedido = pedidos.find(p => p.code === input.pedidoCode);
    if (!pedido) {
      return of(new HttpResponse({ status: 404, body: { message: `Pedido ${input.pedidoCode} no encontrado` } })).pipe(delay(300));
    }
    const { pedidoCode: _omit, ...rest } = input;
    const created: DocumentoOperativo = { ...rest, id: nextDocOperativoId++, pedidoId: pedido.id, estado: 'recibido', recibidoAt: new Date().toISOString() };
    // Idempotencia: un solo documento por (pedido, origen, tipo, fecha).
    documentosOperativos = [
      ...documentosOperativos.filter(
        d => !(d.pedidoId === created.pedidoId && d.origen === created.origen && d.tipo === created.tipo && d.fecha === created.fecha),
      ),
      created,
    ];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(300));
  }
  const docsPedidoId = matchAction(req.url, 'pedidos', 'documentos');
  if (docsPedidoId !== null && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: documentosOperativos.filter(d => d.pedidoId === docsPedidoId) })).pipe(delay(250));
  }
  const avancePedidoId = matchAction(req.url, 'pedidos', 'avance');
  if (avancePedidoId !== null && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: calcularAvance(avancePedidoId) })).pipe(delay(250));
  }

  // ── Prefacturas ──
  if (req.url === '/api/facturacion/prefacturas' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: prefacturas })).pipe(delay(300));
  }
  const prefacturaId = matchId(req.url, 'prefacturas');
  if (prefacturaId !== null && req.method === 'GET') {
    const found = prefacturas.find(p => p.id === prefacturaId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(250));
  }
  const prefacturaPedidoGet = matchAction(req.url, 'pedidos', 'prefactura');
  if (prefacturaPedidoGet !== null && req.method === 'GET') {
    const found = prefacturas.find(p => p.pedidoId === prefacturaPedidoGet);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(250));
  }
  const enviarPrefacturaId = matchAction(req.url, 'prefacturas', 'enviar');
  if (enviarPrefacturaId !== null && req.method === 'PATCH') {
    const { medio, adjuntos, usuario } = req.body as { medio: string; adjuntos: string[]; usuario?: string };
    const now = new Date().toISOString();
    let updated: Prefactura | undefined;
    prefacturas = prefacturas.map(pf => {
      if (pf.id !== enviarPrefacturaId) return pf;
      updated = { ...pf, estado: 'enviada_para_firmas', envioCliente: { enviadoAt: now, medio, adjuntos } };
      return updated;
    });
    if (updated) avanzarPedido(updated.pedidoId, 'enviado_para_firmas', usuario ?? 'Facturación');
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const firmarPrefacturaId = matchAction(req.url, 'prefacturas', 'firmar');
  if (firmarPrefacturaId !== null && req.method === 'PATCH') {
    const { nombre, cargo, usuario } = req.body as { nombre: string; cargo: string; usuario?: string };
    const now = new Date().toISOString();
    let updated: Prefactura | undefined;
    prefacturas = prefacturas.map(pf => {
      if (pf.id !== firmarPrefacturaId) return pf;
      updated = { ...pf, estado: 'firmada', firmaCliente: { nombre, cargo, firmadoAt: now } };
      return updated;
    });
    if (updated) avanzarPedido(updated.pedidoId, 'ticket_firmado', usuario ?? 'Cliente');
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const rechazarPrefacturaId = matchAction(req.url, 'prefacturas', 'rechazar');
  if (rechazarPrefacturaId !== null && req.method === 'PATCH') {
    const { motivo, razonRetraso, devueltoA, itemsObservados, usuario } = req.body as {
      motivo: string;
      razonRetraso?: string;
      devueltoA: string;
      itemsObservados?: string[];
      usuario?: string;
    };
    const now = new Date().toISOString();
    let updated: Prefactura | undefined;
    prefacturas = prefacturas.map(pf => {
      if (pf.id !== rechazarPrefacturaId) return pf;
      updated = { ...pf, estado: 'rechazada', rechazoCliente: { motivo, razonRetraso, devueltoA, itemsObservados, fecha: now } };
      return updated;
    });
    if (updated) {
      avanzarPedido(updated.pedidoId, 'rechazado_por_cliente', usuario ?? 'Cliente', motivo);
      avanzarPedido(updated.pedidoId, 'en_correccion', 'Facturación', `Devuelto a ${devueltoA}`);
    }
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const guiaDePedidoId = matchAction(req.url, 'pedidos', 'guia-remision');
  if (guiaDePedidoId !== null && req.method === 'GET') {
    const found = guiasRemision.find(g => g.pedidoId === guiaDePedidoId) ?? null;
    return of(new HttpResponse({ status: 200, body: found })).pipe(delay(250));
  }
  if (guiaDePedidoId !== null && req.method === 'POST') {
    if (!pedidos.some(p => p.id === guiaDePedidoId)) return of(new HttpResponse({ status: 404, body: null })).pipe(delay(200));
    if (guiasRemision.some(g => g.pedidoId === guiaDePedidoId)) {
      return of(new HttpResponse({ status: 409, body: { message: 'El pedido ya tiene una guía de remisión' } })).pipe(delay(300));
    }
    const body = req.body as Omit<GuiaRemision, 'id' | 'pedidoId' | 'prefacturaId' | 'firmaDynadrill' | 'firmaCliente' | 'guiaRemisionAs2Ref'>;
    const guia: GuiaRemision = { ...body, id: nextGuiaRemisionId++, pedidoId: guiaDePedidoId };
    guiasRemision = [...guiasRemision, guia];
    // La prefactura, si ya existe, queda enlazada a la guía.
    const pf = prefacturas.find(p => p.pedidoId === guiaDePedidoId);
    if (pf) guia.prefacturaId = pf.id;
    return of(new HttpResponse({ status: 201, body: guia })).pipe(delay(400));
  }

  // ── AOT ──
  if (req.url === '/api/facturacion/aots' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: aots })).pipe(delay(300));
  }
  const aotId = matchId(req.url, 'aots');
  if (aotId !== null && req.method === 'GET') {
    const found = aots.find(a => a.id === aotId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(250));
  }
  const aotDePedidoId = matchAction(req.url, 'pedidos', 'aot');
  if (aotDePedidoId !== null && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: aots.find(a => a.pedidoId === aotDePedidoId) ?? null })).pipe(delay(250));
  }
  const aotFirmarId = matchAction(req.url, 'aots', 'firmar');
  if (aotFirmarId !== null && req.method === 'PATCH') {
    let updated: Aot | undefined;
    aots = aots.map(a => (a.id === aotFirmarId ? (updated = { ...a, estado: 'firmada' }) : a));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(300));
  }
  const aotPrefacturaPost = matchAction(req.url, 'prefacturas', 'aot');
  if (aotPrefacturaPost !== null && req.method === 'POST') {
    const pf = prefacturas.find(p => p.id === aotPrefacturaPost);
    if (!pf) return of(new HttpResponse({ status: 404, body: null })).pipe(delay(200));
    if (pf.estado !== 'firmada') {
      return of(new HttpResponse({ status: 422, body: { message: 'La prefactura debe estar firmada por el cliente' } })).pipe(delay(300));
    }
    if (aots.some(a => a.prefacturaId === aotPrefacturaPost)) {
      return of(new HttpResponse({ status: 409, body: { message: 'La prefactura ya tiene AOT' } })).pipe(delay(300));
    }
    const body = req.body as { ciudad?: string; descripcionRequerimiento?: string; representanteCliente?: { nombre: string; cargo: string }; usuario?: string };
    const aot = construirAot(
      aotPrefacturaPost,
      body.ciudad || 'UIO',
      body.descripcionRequerimiento || 'Servicio ejecutado según prefactura',
      body.representanteCliente ?? { nombre: pf.firmaCliente?.nombre ?? '', cargo: pf.firmaCliente?.cargo ?? 'Ingeniero de Operaciones' },
    );
    if (!aot) return of(new HttpResponse({ status: 404, body: null })).pipe(delay(200));
    aots = [...aots, aot];
    avanzarPedido(aot.pedidoId, 'aot_generada', body.usuario ?? 'Facturación');
    return of(new HttpResponse({ status: 201, body: aot })).pipe(delay(400));
  }

  const prefacturaPedidoPost = matchAction(req.url, 'pedidos', 'prefactura');
  if (prefacturaPedidoPost !== null && req.method === 'POST') {
    const existente = prefacturas.find(p => p.pedidoId === prefacturaPedidoPost);
    // Flujo "corregir y reenviar" (FACT-003): una prefactura RECHAZADA se puede regenerar
    // (reemplaza a la anterior) una vez corregida la documentación. Cualquier otro estado
    // ya tiene una prefactura vigente y no se puede generar otra.
    if (existente && existente.estado !== 'rechazada') {
      return of(new HttpResponse({ status: 409, body: { message: 'El pedido ya tiene una prefactura' } })).pipe(delay(300));
    }
    if (!calcularAvance(prefacturaPedidoPost).completo) {
      return of(new HttpResponse({ status: 422, body: { message: 'La documentación de respaldo está incompleta' } })).pipe(delay(300));
    }
    const { usuario } = (req.body as { usuario?: string }) ?? {};
    const pf = construirPrefactura(prefacturaPedidoPost, usuario);
    if (!pf) return of(new HttpResponse({ status: 404, body: null })).pipe(delay(200));
    if (existente) prefacturas = prefacturas.filter(p => p.id !== existente.id);
    prefacturas = [...prefacturas, pf];
    avanzarPedido(prefacturaPedidoPost, 'prefactura_generada', usuario ?? 'Facturación');
    return of(new HttpResponse({ status: 201, body: pf })).pipe(delay(400));
  }

  // ── Listas de Precios ──
  if (req.url === '/api/facturacion/listas-precios' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: listasPrecios })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/listas-precios' && req.method === 'POST') {
    const input = req.body as CreateListaPreciosInput;
    const created: ListaPrecios = {
      cliente: input.cliente,
      numeroContrato: input.numeroContrato,
      vigenteDesde: input.vigenteDesde,
      activa: input.activa,
      id: nextListaId++,
      items: (input.items ?? []).map(it => ({ ...it, id: nextListaItemId++ })),
    };
    listasPrecios = [...listasPrecios, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const listaId = matchId(req.url, 'listas-precios');
  if (listaId !== null && req.method === 'GET') {
    const found = listasPrecios.find(l => l.id === listaId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(250));
  }
  const listaItemsId = matchAction(req.url, 'listas-precios', 'items');
  if (listaItemsId !== null && req.method === 'PUT') {
    const drafts = req.body as ListaPreciosItemDraft[];
    let updated: ListaPrecios | undefined;
    listasPrecios = listasPrecios.map(l => {
      if (l.id !== listaItemsId) return l;
      updated = { ...l, items: drafts.map(d => ({ ...d, id: nextListaItemId++ })) };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  if (listaId !== null && req.method === 'PATCH') {
    const patch = req.body as Partial<Pick<ListaPrecios, 'cliente' | 'numeroContrato' | 'vigenteDesde' | 'activa'>>;
    let updated: ListaPrecios | undefined;
    listasPrecios = listasPrecios.map(l => {
      if (l.id !== listaId) return l;
      updated = { ...l, ...patch };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(350));
  }

  return next(req);
};
