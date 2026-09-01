import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import {
  ActaEntregaRecepcion,
  As2CatalogoItem,
  As2PedidoInfo,
  CreateActaEntregaInput,
  CreateDocumentacionDiariaInput,
  CreateExcepcionInput,
  CreateFacturacionTicketInput,
  CreateGuiaCampoInput,
  CreateOtqInput,
  DocumentacionDiaria,
  Excepcion,
  FacturacionTicket,
  GuiaCampo,
  Otq,
  OtqVersion,
  ticketSubtotales,
} from '../../features/facturacion/models/facturacion.model';

/**
 * Simulación de AS2 (FACT-001) — "espejo" de lo que el Portal Interno
 * consultaría vía API real cuando exista el API key. pedidoId=3 y 6 son
 * los mismos PumpingTicket ya sembrados en pumping-mock.interceptor.ts —
 * cualquier otro pedidoId (ej. 4, que no existe como ticket real de
 * Pumping) simula correctamente el caso "no existe en AS2".
 */
const as2Pedidos: As2PedidoInfo[] = [
  {
    pedidoId: 3,
    cliente: 'Petroecuador',
    numeroContrato: '2025201',
    campo: 'SACHA',
    bloque: 'BLOQUE 60',
    pozo: 'BETA-9',
    taladro: 'VICTORIA 01',
    supervisorOperativo: 'Luis Vega',
    tecnicoHse: 'Ana Torres',
  },
  {
    pedidoId: 6,
    cliente: 'Petroandina',
    numeroContrato: '2025201',
    campo: 'AUCA',
    bloque: 'BLOQUE 61',
    pozo: 'DELTA-7',
    supervisorOperativo: 'Luis Vega',
    tecnicoHse: 'Ana Torres',
  },
];

/**
 * Subconjunto real (~40 de 1300+ ítems) de "Lista de precios contrato
 * 2025201.xlsx" — el contrato que ya usan los OTQ sembrados. Representa el
 * catálogo que en producción vendría anclado al contrato en AS2; el Portal
 * Interno solo lo consulta, no lo crea ni lo edita.
 */
const as2Catalogo: As2CatalogoItem[] = [
  { codigo: 'SB3201', descripcion: 'Viaje por unidad de bombeo para estimulación', unidad: 'km', tarifaUnitaria: 3.15 },
  { codigo: 'SB3205', descripcion: 'Unidad de bombeo para estimulación por hora adicional o fracción', unidad: 'hr', tarifaUnitaria: 26.78 },
  { codigo: 'SB3208', descripcion: 'Bombeo de ácido primeros 2.000 galones', unidad: 'gls', tarifaUnitaria: 0.33 },
  { codigo: 'SB3209', descripcion: 'Bombeo de ácido de 2.001 a 4.000 galones', unidad: 'gls', tarifaUnitaria: 0.33 },
  { codigo: 'SB3211', descripcion: 'Bombeo de fluidos no corrosivos primeros 2.000 galones', unidad: 'gls', tarifaUnitaria: 0.25 },
  { codigo: 'SB3214', descripcion: 'Tanque para tratamiento de 100 barriles', unidad: 'unidad', tarifaUnitaria: 257.1 },
  { codigo: 'SB3216', descripcion: 'Cargo por monitoreo standard de presión, caudal y densidad', unidad: 'unidad', tarifaUnitaria: 373.8 },
  { codigo: 'SB3219', descripcion: 'Registrador de presión tipo Martín Decker por trabajo', unidad: 'unidad', tarifaUnitaria: 91.67 },
  { codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', tarifaUnitaria: 437.23 },
  { codigo: 'SB3227', descripcion: 'Operador para estimulación día o fracción', unidad: 'día', tarifaUnitaria: 349.78 },
  { codigo: 'SB3228', descripcion: 'Asistente de Operaciones para estimulación día o fracción', unidad: 'día', tarifaUnitaria: 109.31 },
  { codigo: 'SB3229', descripcion: 'Tanque para fluidos de estimulación 500 bbls', unidad: 'unidad', tarifaUnitaria: 678.36 },
  { codigo: 'SB3230', descripcion: 'Servicio de Winche para bajar o subir tanques y silos', unidad: 'día', tarifaUnitaria: 1539.21 },
  { codigo: 'SB3232', descripcion: 'Unidad de Monitoreo parámetros de Operación en camper', unidad: 'unidad', tarifaUnitaria: 2121.62 },
  { codigo: 'SB3233', descripcion: 'Movilización unidades livianas para personal', unidad: 'km', tarifaUnitaria: 2.66 },
  { codigo: 'SB3235', descripcion: 'Cargo Básico Vacuum para transporte agua limpia 4 hr, capacidad 180 bbls', unidad: 'unidad', tarifaUnitaria: 350.32 },
  { codigo: 'SB3239', descripcion: 'Ingeniero de Operaciones de estimulación', unidad: 'día', tarifaUnitaria: 721.64 },
  { codigo: 'SB3240', descripcion: 'Cargo básico, primeras 4 horas o fracción de bombeo unidad de estimulación (700 HP)', unidad: 'unidad', tarifaUnitaria: 3180.54 },
  { codigo: 'SB3242', descripcion: 'Supervisor Senior para estimulación día o fracción', unidad: 'día', tarifaUnitaria: 749.46 },
  { codigo: 'SFC33001', descripcion: 'Viaje por unidad de bombeo para tratamientos en superficie', unidad: 'km', tarifaUnitaria: 3.15 },
  { codigo: 'SFC33032', descripcion: 'Supervisor Senior para fluidos de completación día o fracción', unidad: 'día', tarifaUnitaria: 833.41 },
  { codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', unidad: 'bbl', tarifaUnitaria: 34.9 },
  { codigo: 'CT5134', descripcion: 'Supervisor Coiled Tubing día o fracción', unidad: 'día', tarifaUnitaria: 806.54 },
  { codigo: 'CT5135', descripcion: 'Operador Coiled Tubing día o fracción', unidad: 'día', tarifaUnitaria: 349.78 },
  { codigo: 'CT5146', descripcion: 'Ingeniero de Operaciones Coiled tubing', unidad: 'día', tarifaUnitaria: 721.64 },
  { codigo: 'CT5147', descripcion: 'Grúa 30 Tons', unidad: 'día', tarifaUnitaria: 1640.64 },
  { codigo: 'SB3602', descripcion: 'Líneas de acero de descarga de 2" 15000PSI WP, por día para Bombeo de nitrógeno 80 ft min', unidad: 'día', tarifaUnitaria: 1242.62 },
  { codigo: 'SB3604', descripcion: 'Cargo básico primeras 4 horas o fracción unidad de nitrógeno, hasta 5000 psi', unidad: 'unidad', tarifaUnitaria: 1650.52 },
  { codigo: 'SB3611', descripcion: 'Tanque criogénico de 6200 gal por trabajo', unidad: 'día', tarifaUnitaria: 545.31 },
  { codigo: 'SB3616', descripcion: 'Supervisor operaciones Nitrógeno día o fracción', unidad: 'día', tarifaUnitaria: 806.54 },
  { codigo: 'SB3617', descripcion: 'Operador operaciones Nitrógeno día o fracción', unidad: 'día', tarifaUnitaria: 349.78 },
  { codigo: 'QP21301', descripcion: 'Dispersante de parafinas crudos livianos', unidad: 'gls', tarifaUnitaria: 33.29 },
  { codigo: 'QP21305', descripcion: 'Bactericida base gluther aldéhido', unidad: 'gls', tarifaUnitaria: 128.97 },
  { codigo: 'QP21319', descripcion: 'Secuestrante de sulfhídrico', unidad: 'gls', tarifaUnitaria: 70.72 },
  { codigo: 'STQ223801', descripcion: 'Supervisor para tratamientos químicos día o fracción', unidad: 'día', tarifaUnitaria: 423.42 },
  { codigo: 'STQ223802', descripcion: 'Operador para tratamientos químicos día o fracción', unidad: 'día', tarifaUnitaria: 352.85 },
  { codigo: 'F10080', descripcion: 'Geomembrana PVC negra 750 micras, rollos de 1.4 m x 50 m', unidad: 'M2', tarifaUnitaria: 4.94 },
  { codigo: 'QA21403', descripcion: 'Paño absorbente orgánico en paquete de 50 unidades. Tipo 1', unidad: 'unidad', tarifaUnitaria: 66.73 },
];

/**
 * Solo activo mientras no exista el backend real de Facturación (mismo
 * patrón que el resto de interceptores de mocks). Semilla basada en datos
 * reales de una plantilla de ticket que Dynadrill ya usa hoy
 * (PUMPING 3784-SCHAD-365), para que la demo se sienta real.
 *
 * pedidoId=3 referencia el PumpingTicket "PUMP-2026-00458" (Pozo Beta-9,
 * Petroecuador) que ya existe en pumping-mock.interceptor.ts — en
 * ejecución, con 2 días homologados y una excepción de sobrepaso activa.
 * pedidoId=6 referencia "PUMP-2026-00461" (Pozo Delta-7, Petroandina) —
 * ya cerrado, con Ticket generado.
 */

let otqs: Otq[] = [
  {
    id: 1,
    numero: 'OTQ-2026-0003',
    pedidoId: 3,
    cliente: 'Petroecuador',
    numeroContrato: '2025201',
    campo: 'SACHA',
    bloque: 'BLOQUE 60',
    pozo: 'BETA-9',
    taladro: 'VICTORIA 01',
    items: [
      { id: 1, codigo: 'SFC33032', descripcion: 'Supervisor Senior para fluidos de completación día o fracción', unidad: 'día', tarifaUnitaria: 833.41, cantidadEstimada: 3, total: 2500.23 },
      { id: 2, codigo: 'SFC33001', descripcion: 'Viaje por unidad de bombeo para tratamientos en superficie', unidad: 'km', tarifaUnitaria: 3.15, cantidadEstimada: 67.4, total: 212.31 },
      { id: 3, codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', unidad: 'bbl', tarifaUnitaria: 34.9, cantidadEstimada: 300, total: 10470 },
    ],
    representanteLegal: 'Ab. Mónica Rojas',
    estado: 'aprobada',
    createdAt: '2026-08-15T08:00:00.000Z',
    version: 1,
    historialVersiones: [],
  },
  {
    id: 2,
    numero: 'OTQ-2026-0006',
    pedidoId: 6,
    cliente: 'Petroandina',
    numeroContrato: '2025201',
    campo: 'AUCA',
    bloque: 'BLOQUE 61',
    pozo: 'DELTA-7',
    items: [
      { id: 1, codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', tarifaUnitaria: 437.23, cantidadEstimada: 2, total: 874.46 },
      { id: 2, codigo: 'SB3208', descripcion: 'Bombeo de ácido primeros 2.000 galones', unidad: 'gls', tarifaUnitaria: 0.33, cantidadEstimada: 2000, total: 660 },
    ],
    representanteLegal: 'Ab. Mónica Rojas',
    estado: 'aprobada',
    createdAt: '2026-08-01T08:00:00.000Z',
    version: 1,
    historialVersiones: [],
  },
];

let documentacion: DocumentacionDiaria[] = [
  {
    id: 1,
    pedidoId: 3,
    fecha: '2026-08-20',
    hojasTiempo: [{ nombre: 'Hermes Páez', cargo: 'Supervisor', horasNormales: 8, horasExtras: 2, horasNocturnas: 0 }],
    usoEquipos: [{ unidadId: 15, unidadCode: 'PUM-15', horometroInicial: 1200, horometroFinal: 1210, combustibleConsumido: 40, operador: 'Carlos Vega' }],
    consumoMateriales: [{ codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', cantidad: 150, unidad: 'bbl' }],
    items: [
      { codigo: 'SFC33032', descripcion: 'Supervisor Senior para fluidos de completación día o fracción', unidad: 'día', cantidad: 1, tipo: 'Servicio' },
      { codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', unidad: 'bbl', cantidad: 150, tipo: 'Material' },
    ],
    estado: 'homologado',
    firmaSupervisor: { nombre: 'Hermes Páez', firmadoAt: '2026-08-20T19:30:00.000Z' },
    registradoPor: 'Hermes Páez',
    registradoAt: '2026-08-20T18:30:00.000Z',
    homologadoPor: 'Ricardo Vallejo',
    homologadoAt: '2026-08-20T20:00:00.000Z',
  },
  {
    id: 2,
    pedidoId: 3,
    fecha: '2026-08-21',
    hojasTiempo: [{ nombre: 'Hermes Páez', cargo: 'Supervisor', horasNormales: 8, horasExtras: 0, horasNocturnas: 0 }],
    usoEquipos: [{ unidadId: 15, unidadCode: 'PUM-15', horometroInicial: 1210, horometroFinal: 1218, combustibleConsumido: 32, operador: 'Carlos Vega' }],
    consumoMateriales: [{ codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', cantidad: 150, unidad: 'bbl' }],
    items: [
      { codigo: 'SFC33032', descripcion: 'Supervisor Senior para fluidos de completación día o fracción', unidad: 'día', cantidad: 1, tipo: 'Servicio' },
      { codigo: 'SFC33001', descripcion: 'Viaje por unidad de bombeo para tratamientos en superficie', unidad: 'km', cantidad: 67.4, tipo: 'Servicio' },
      { codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', unidad: 'bbl', cantidad: 150, tipo: 'Material' },
    ],
    estado: 'pendiente_supervisor',
    registradoPor: 'Hermes Páez',
    registradoAt: '2026-08-21T19:00:00.000Z',
  },
];

let excepciones: Excepcion[] = [
  {
    id: 1,
    pedidoId: 3,
    tipo: 'sobrepaso',
    estado: 'en_negociacion',
    montoExcedente: 1250.5,
    justificacion: 'El pozo requirió 50 bbl adicionales de fluido de completación no previstos en la OTQ original.',
    createdAt: '2026-08-21T18:00:00.000Z',
  },
];

let guiasCampo: GuiaCampo[] = [
  {
    id: 1,
    pedidoId: 3,
    cliente: 'Petroecuador',
    campo: 'SACHA',
    pozo: 'BETA-9',
    fecha: '2026-08-20',
    unidadId: 15,
    unidadCode: 'PUM-15',
    items: [{ codigo: 'DYFCE-70', descripcion: 'Fluido Completación Especial Tipo 7', cantidad: 300, unidad: 'bbl', tipo: 'Material' }],
    firmaCompanyMan: { nombre: 'Ing. Daniel Balseca', cedula: '1803906450', cargo: 'Company Man', firmadoAt: '2026-08-20T19:30:00.000Z' },
    firmaDynadrill: { nombre: 'Ricardo Vallejo', firmadoAt: '2026-08-20T19:30:00.000Z' },
  },
];

let actas: ActaEntregaRecepcion[] = [
  {
    id: 1,
    pedidoId: 6,
    trabajosRealizados: 'Servicio de estimulación con bombeo de ácido completado según OTQ-2026-0006.',
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-03',
    firmaSupervisor: { nombre: 'Ana Ruiz', firmadoAt: '2026-08-03T18:00:00.000Z' },
    firmaCompanyMan: { nombre: 'Ing. Alex Fabara', cedula: '1720193281', cargo: 'Company man', firmadoAt: '2026-08-03T18:05:00.000Z' },
  },
];

let tickets: FacturacionTicket[] = (() => {
  const items = [
    { id: 1, codigo: 'SB3226', descripcion: 'Supervisor para estimulación día o fracción', unidad: 'día', cantidad: 2, precioUnitario: 437.23, precioTotal: 874.46, tipo: 'Servicio' as const },
    { id: 2, codigo: 'SB3208', descripcion: 'Bombeo de ácido primeros 2.000 galones', unidad: 'gls', cantidad: 2000, precioUnitario: 0.33, precioTotal: 660, tipo: 'Material' as const },
  ];
  const { servicios, materiales, subtotal, iva, retencionIR, retencionIVA, netoCobrar } = ticketSubtotales(items);
  return [
    {
      id: 1,
      code: 'TKT-2026-0006',
      pedidoId: 6,
      otqId: 2,
      items,
      subtotalServicios: servicios,
      subtotalMateriales: materiales,
      subtotal,
      iva,
      retencionIR,
      retencionIVA,
      netoCobrar,
      estado: 'cerrado',
      firmaAutorizadoDynadrill: { nombre: 'Ricardo Vallejo', firmadoAt: '2026-08-03T18:10:00.000Z' },
      firmaCompanyMan: { nombre: 'Ing. Alex Fabara', cedula: '1720193281', cargo: 'Company man', firmadoAt: '2026-08-03T18:10:00.000Z' },
      fechaCierre: '2026-08-03T18:10:00.000Z',
    },
  ];
})();

let nextOtqId = 3;
let nextDocId = 3;
let nextExcepcionId = 2;
let nextGuiaId = 2;
let nextActaId = 2;
let nextTicketId = 2;

function matchId(url: string, resource: string): number | null {
  const match = url.match(new RegExp(`/api/facturacion/${resource}/(\\d+)`));
  return match ? Number(match[1]) : null;
}

function matchAction(url: string, resource: string, action: string): number | null {
  const match = url.match(new RegExp(`/api/facturacion/${resource}/(\\d+)/${action}`));
  return match ? Number(match[1]) : null;
}

export const facturacionMockInterceptor: HttpInterceptorFn = (req, next) => {
  // ── AS2 (simulado) ──
  if (req.url.startsWith('/api/facturacion/as2/catalogo') && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: as2Catalogo })).pipe(delay(350));
  }
  const as2PedidoId = matchId(req.url, 'as2/pedido');
  if (as2PedidoId !== null && req.method === 'GET') {
    const found = as2Pedidos.find(p => p.pedidoId === as2PedidoId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(500));
  }

  // ── OTQ ──
  if (req.url === '/api/facturacion/otq' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: otqs })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/otq' && req.method === 'POST') {
    const input = req.body as CreateOtqInput;
    const created: Otq = { ...input, id: nextOtqId++, estado: 'borrador', createdAt: new Date().toISOString(), version: 1, historialVersiones: [] };
    otqs = [...otqs, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const otqId = matchId(req.url, 'otq');
  if (otqId !== null && req.method === 'GET') {
    const found = otqs.find(o => o.id === otqId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }
  const otqItemsId = matchAction(req.url, 'otq', 'items');
  if (otqItemsId !== null && req.method === 'PATCH') {
    const { items, motivo } = req.body as { items: Omit<Otq['items'][number], 'id' | 'total'>[]; motivo?: string };
    let updated: Otq | undefined;
    otqs = otqs.map(o => {
      if (o.id !== otqItemsId) return o;
      // FACT-003 — archiva la versión vigente antes de sobrescribir los ítems.
      const snapshot: OtqVersion = { version: o.version, items: o.items, motivo: motivo ?? 'Cambio de alcance', fecha: new Date().toISOString() };
      updated = {
        ...o,
        items: items.map((it, idx) => ({ ...it, id: idx + 1, total: Math.round(it.tarifaUnitaria * it.cantidadEstimada * 100) / 100 })),
        version: o.version + 1,
        historialVersiones: [...(o.historialVersiones ?? []), snapshot],
      };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const otqActivarId = matchAction(req.url, 'otq', 'activar');
  if (otqActivarId !== null && req.method === 'PATCH') {
    const { activadaPor } = req.body as { activadaPor: string };
    let updated: Otq | undefined;
    otqs = otqs.map(o => {
      if (o.id !== otqActivarId) return o;
      updated = { ...o, estado: 'aprobada', activadaPor, activadaAt: new Date().toISOString() };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  // ── Documentación diaria ──
  if (req.url === '/api/facturacion/documentacion' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: documentacion })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/documentacion' && req.method === 'POST') {
    const input = req.body as CreateDocumentacionDiariaInput;
    const created: DocumentacionDiaria = { ...input, id: nextDocId++, estado: 'pendiente_supervisor', registradoAt: new Date().toISOString() };
    documentacion = [...documentacion, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const firmarSupervisorId = matchAction(req.url, 'documentacion', 'firmar-supervisor');
  if (firmarSupervisorId !== null && req.method === 'PATCH') {
    const { nombreSupervisor } = req.body as { nombreSupervisor: string };
    let updated: DocumentacionDiaria | undefined;
    documentacion = documentacion.map(d => {
      if (d.id !== firmarSupervisorId) return d;
      updated = { ...d, estado: 'pendiente', firmaSupervisor: { nombre: nombreSupervisor, firmadoAt: new Date().toISOString() } };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const homologarId = matchAction(req.url, 'documentacion', 'homologar');
  if (homologarId !== null && req.method === 'PATCH') {
    const { homologadoPor, observaciones } = req.body as { homologadoPor: string; observaciones?: string };
    let updated: DocumentacionDiaria | undefined;
    documentacion = documentacion.map(d => {
      if (d.id !== homologarId) return d;
      updated = { ...d, estado: 'homologado', homologadoPor, homologadoAt: new Date().toISOString(), observacionesHomologacion: observaciones };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const rechazarDocId = matchAction(req.url, 'documentacion', 'rechazar');
  if (rechazarDocId !== null && req.method === 'PATCH') {
    const { observaciones } = req.body as { observaciones: string };
    let updated: DocumentacionDiaria | undefined;
    documentacion = documentacion.map(d => {
      if (d.id !== rechazarDocId) return d;
      updated = { ...d, estado: 'rechazado', observacionesHomologacion: observaciones };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  // ── Excepciones ──
  if (req.url === '/api/facturacion/excepciones' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: excepciones })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/excepciones' && req.method === 'POST') {
    const input = req.body as CreateExcepcionInput;
    const created: Excepcion = { ...input, id: nextExcepcionId++, estado: 'en_negociacion', createdAt: new Date().toISOString() };
    excepciones = [...excepciones, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const aprobarClienteId = matchAction(req.url, 'excepciones', 'aprobar-cliente');
  if (aprobarClienteId !== null && req.method === 'PATCH') {
    let updated: Excepcion | undefined;
    excepciones = excepciones.map(e => {
      if (e.id !== aprobarClienteId) return e;
      updated = { ...e, aprobacionClienteAt: new Date().toISOString(), estado: 'aprobada' };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const aprobarGerenciaId = matchAction(req.url, 'excepciones', 'aprobar-gerencia');
  if (aprobarGerenciaId !== null && req.method === 'PATCH') {
    let updated: Excepcion | undefined;
    excepciones = excepciones.map(e => {
      if (e.id !== aprobarGerenciaId) return e;
      updated = { ...e, aprobacionGerenciaAt: new Date().toISOString(), estado: 'aprobada' };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }
  const rechazarExcepcionId = matchAction(req.url, 'excepciones', 'rechazar');
  if (rechazarExcepcionId !== null && req.method === 'PATCH') {
    let updated: Excepcion | undefined;
    excepciones = excepciones.map(e => {
      if (e.id !== rechazarExcepcionId) return e;
      updated = { ...e, estado: 'rechazada' };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  // ── Guías de campo ──
  if (req.url === '/api/facturacion/guias-campo' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: guiasCampo })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/guias-campo' && req.method === 'POST') {
    const input = req.body as CreateGuiaCampoInput;
    const created: GuiaCampo = { ...input, id: nextGuiaId++ };
    guiasCampo = [...guiasCampo, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const firmarGuiaId = matchAction(req.url, 'guias-campo', 'firmar');
  if (firmarGuiaId !== null && req.method === 'PATCH') {
    const { firmaDynadrillNombre, companyMan } = req.body as { firmaDynadrillNombre: string; companyMan: { nombre: string; cedula: string; cargo: string } };
    const now = new Date().toISOString();
    let updated: GuiaCampo | undefined;
    guiasCampo = guiasCampo.map(g => {
      if (g.id !== firmarGuiaId) return g;
      updated = { ...g, firmaDynadrill: { nombre: firmaDynadrillNombre, firmadoAt: now }, firmaCompanyMan: { ...companyMan, firmadoAt: now } };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  // ── Actas de entrega-recepción ──
  if (req.url === '/api/facturacion/actas' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: actas })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/actas' && req.method === 'POST') {
    const input = req.body as CreateActaEntregaInput;
    const created: ActaEntregaRecepcion = { ...input, id: nextActaId++ };
    actas = [...actas, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const firmarActaId = matchAction(req.url, 'actas', 'firmar');
  if (firmarActaId !== null && req.method === 'PATCH') {
    const { firmaSupervisorNombre, companyMan } = req.body as { firmaSupervisorNombre: string; companyMan: { nombre: string; cedula: string; cargo: string } };
    const now = new Date().toISOString();
    let updated: ActaEntregaRecepcion | undefined;
    actas = actas.map(a => {
      if (a.id !== firmarActaId) return a;
      updated = { ...a, firmaSupervisor: { nombre: firmaSupervisorNombre, firmadoAt: now }, firmaCompanyMan: { ...companyMan, firmadoAt: now } };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  // ── Tickets ──
  if (req.url === '/api/facturacion/tickets' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: tickets })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/tickets' && req.method === 'POST') {
    const input = req.body as CreateFacturacionTicketInput;
    const { servicios, materiales, subtotal, iva, retencionIR, retencionIVA, netoCobrar } = ticketSubtotales(input.items);
    const created: FacturacionTicket = {
      ...input,
      id: nextTicketId,
      code: `TKT-2026-${String(nextTicketId).padStart(4, '0')}`,
      subtotalServicios: servicios,
      subtotalMateriales: materiales,
      subtotal,
      iva,
      retencionIR,
      retencionIVA,
      netoCobrar,
      estado: 'cerrado',
      fechaCierre: new Date().toISOString(),
    };
    nextTicketId++;
    tickets = [...tickets, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }
  const ticketId = matchId(req.url, 'tickets');
  if (ticketId !== null && req.method === 'GET') {
    const found = tickets.find(t => t.id === ticketId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }
  const facturarId = matchAction(req.url, 'tickets', 'facturar');
  if (facturarId !== null && req.method === 'PATCH') {
    const { facturaAs2Ref } = req.body as { facturaAs2Ref?: string };
    let updated: FacturacionTicket | undefined;
    tickets = tickets.map(t => {
      if (t.id !== facturarId) return t;
      updated = { ...t, estado: 'facturado', facturaAs2Ref };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  return next(req);
};
