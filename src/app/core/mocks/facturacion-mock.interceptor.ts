import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import {
  ActaEntregaRecepcion,
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
  ticketSubtotales,
} from '../../features/facturacion/models/facturacion.model';

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
    registradoPor: 'Hermes Páez',
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
    estado: 'pendiente',
    registradoPor: 'Hermes Páez',
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
  // ── OTQ ──
  if (req.url === '/api/facturacion/otq' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: otqs })).pipe(delay(300));
  }
  if (req.url === '/api/facturacion/otq' && req.method === 'POST') {
    const input = req.body as CreateOtqInput;
    const created: Otq = { ...input, id: nextOtqId++, estado: 'borrador', createdAt: new Date().toISOString() };
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
    const { items } = req.body as { items: Omit<Otq['items'][number], 'id' | 'total'>[] };
    let updated: Otq | undefined;
    otqs = otqs.map(o => {
      if (o.id !== otqItemsId) return o;
      updated = { ...o, items: items.map((it, idx) => ({ ...it, id: idx + 1, total: Math.round(it.tarifaUnitaria * it.cantidadEstimada * 100) / 100 })) };
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
    const created: DocumentacionDiaria = { ...input, id: nextDocId++, estado: 'pendiente' };
    documentacion = [...documentacion, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
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
