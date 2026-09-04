import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { FcrTicket, FcrTool } from '../../features/operations/fcr/models/fcr.model';

let tickets: FcrTicket[] = [
  // ── Validación: única fase que ningún otro ticket demo cubre — "Solicitar corrección" y "Aprobar información" viven aquí ──
  {
    id: 119,
    code: 'FCR-119',
    status: 'en_revision',
    wellName: 'Campo Sacha, Pozo 21',
    clientName: 'Petroecuador',
    estimatedDate: '2026-09-10',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: '',
    unitCode: '',
    currentPhase: 'validacion',
    proposalVersion: 1,
    tools: [],
    toolListConfirmed: false,
    inspectionDocumentUploaded: false,
    movementGuideGenerated: false,
    reviewGuideGenerated: false,
    operationalMeetingDate: '',
    operationalActaSigned: false,
    workReportUploaded: false,
    toolReportUploaded: false,
    finalReviewGuideUploaded: false,
    activityLog: [],
    toolUsageLog: [],
    observations: [],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Ticket principal de demo: Preparación de Herramientas, con historial de observaciones ──
  {
    id: 118,
    code: 'FCR-118',
    status: 'en_ejecucion',
    wellName: 'Campo Sacha, Pozo 14',
    clientName: 'Petroecuador',
    estimatedDate: '2026-09-02',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: '',
    unitCode: '',
    currentPhase: 'preparacion_herramientas',
    proposalVersion: 2,
    tools: [
      { id: 1, name: 'Tubería de perforación 5"', status: 'recibida' },
      { id: 2, name: 'Estabilizador 8 1/2"', status: 'recibida' },
      { id: 3, name: 'Martillo de fondo', status: 'en_preparacion', sentToSupervisor: true },
      { id: 4, name: 'Sarta de perforación', status: 'en_preparacion', sentToSupervisor: true },
      { id: 5, name: 'Broca tricónica 12 1/4"', status: 'seleccionada' },
    ],
    toolListConfirmed: false,
    inspectionDocumentUploaded: false,
    movementGuideGenerated: false,
    reviewGuideGenerated: false,
    operationalMeetingDate: '',
    operationalActaSigned: false,
    workReportUploaded: false,
    toolReportUploaded: false,
    finalReviewGuideUploaded: false,
    activityLog: [],
    toolUsageLog: [],
    observations: [
      { id: 1, author: 'C. Herrera', role: 'Supervisor', date: '2026-08-30', message: 'Falta el apartado de herramientas en la propuesta original.' },
      { id: 2, author: 'V. Romero', role: 'Ingeniería de Ventas', date: '2026-08-31', message: 'Corregido: apartado de herramientas incluido en V2.' },
    ],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Revisión de Reportes ──
  {
    id: 117,
    code: 'FCR-117',
    status: 'en_ejecucion',
    wellName: 'Campo Auca, Pozo 8',
    clientName: 'Andes Petroleum',
    estimatedDate: '2026-08-29',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: 'J. Paredes',
    unitCode: 'FCR-04',
    currentPhase: 'revision_reportes',
    proposalVersion: 1,
    tools: [
      { id: 6, name: 'Tubería de perforación 5"', status: 'recibida' },
      { id: 7, name: 'Estabilizador 6 3/4"', status: 'recibida' },
    ],
    toolListConfirmed: true,
    inspectionDocumentUploaded: true,
    movementGuideGenerated: true,
    reviewGuideGenerated: true,
    operationalMeetingDate: '2026-08-28T08:00:00.000Z',
    operationalActaSigned: true,
    workReportUploaded: true,
    toolReportUploaded: true,
    finalReviewGuideUploaded: true,
    activityLog: [],
    toolUsageLog: [],
    observations: [
      { id: 1, author: 'C. Herrera', role: 'Supervisor', date: '2026-08-30', message: 'Falta firma del acta operativa en el reporte de trabajo.' },
      { id: 2, author: 'J. Paredes', role: 'Operador', date: '2026-08-31', message: 'Corregido: acta adjunta en el reporte actualizado.' },
    ],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Ejecución de Campo ──
  {
    id: 116,
    code: 'FCR-116',
    status: 'en_ejecucion',
    wellName: 'Campo Shushufindi, Pozo 22',
    clientName: 'Orión',
    estimatedDate: '2026-08-27',
    assignedSupervisor: 'L. Vega',
    assignedOperator: 'M. Salazar',
    unitCode: 'FCR-02',
    currentPhase: 'ejecucion_campo',
    proposalVersion: 1,
    // Link de demo con Facturación: al aprobar los reportes de este ticket
    // se empujan Reporte Job + Reporte de Herramientas al Pedido 4313.
    pedidoCode: '4313',
    tools: [
      { id: 8, name: 'Tubería de perforación 5"', status: 'recibida' },
    ],
    toolListConfirmed: true,
    inspectionDocumentUploaded: true,
    movementGuideGenerated: true,
    reviewGuideGenerated: true,
    operationalMeetingDate: '2026-08-26T08:00:00.000Z',
    operationalActaSigned: true,
    workReportUploaded: false,
    toolReportUploaded: false,
    finalReviewGuideUploaded: false,
    activityLog: [
      { id: 1, date: '2026-08-27', startTime: '07:00', endTime: '08:30', durationHours: 1.5, detail: 'Personal y equipos de Dynadrill arriban a locación, coordinan trabajo con Company Man.', author: 'M. Salazar' },
      { id: 2, date: '2026-08-27', startTime: '08:30', endTime: '12:00', durationHours: 3.5, detail: 'Arma BHA con tubería de perforación 5" y baja a profundidad objetivo.', author: 'M. Salazar' },
    ],
    toolUsageLog: [
      { id: 1, toolId: 8, date: '2026-08-27', status: 'operacion' },
    ],
    observations: [],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Control de Retorno: única fase que ningún otro ticket demo cubre directamente ──
  {
    id: 120,
    code: 'FCR-120',
    status: 'en_ejecucion',
    wellName: 'Campo Sacha, Pozo 18',
    clientName: 'Petroecuador',
    estimatedDate: '2026-08-24',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: 'M. Salazar',
    unitCode: 'FCR-03',
    currentPhase: 'control_retorno',
    proposalVersion: 1,
    tools: [
      { id: 14, name: 'Tubería de perforación 5"', status: 'recibida' },
      { id: 15, name: 'Estabilizador 8 1/2"', status: 'recibida' },
      { id: 16, name: 'Broca tricónica 12 1/4"', status: 'recibida' },
    ],
    toolListConfirmed: true,
    inspectionDocumentUploaded: true,
    movementGuideGenerated: true,
    reviewGuideGenerated: true,
    operationalMeetingDate: '2026-08-22T08:00:00.000Z',
    operationalActaSigned: true,
    workReportUploaded: true,
    toolReportUploaded: true,
    finalReviewGuideUploaded: true,
    activityLog: [],
    toolUsageLog: [],
    observations: [],
    reportsApproved: true,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Preparación de Herramientas (segundo ejemplo, sin observaciones) ──
  {
    id: 115,
    code: 'FCR-115',
    status: 'en_ejecucion',
    wellName: 'Campo Sacha, Pozo 9',
    clientName: 'Petroecuador',
    estimatedDate: '2026-09-04',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: '',
    unitCode: '',
    currentPhase: 'preparacion_herramientas',
    proposalVersion: 1,
    tools: [
      { id: 9, name: 'Tubería de perforación 5"', status: 'en_preparacion', sentToSupervisor: true },
    ],
    toolListConfirmed: false,
    inspectionDocumentUploaded: false,
    movementGuideGenerated: false,
    reviewGuideGenerated: false,
    operationalMeetingDate: '',
    operationalActaSigned: false,
    workReportUploaded: false,
    toolReportUploaded: false,
    finalReviewGuideUploaded: false,
    activityLog: [],
    toolUsageLog: [],
    observations: [],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  },
  // ── Cerrado, con herramienta faltante por venta complementaria ──
  {
    id: 110,
    code: 'FCR-110',
    status: 'cerrado',
    wellName: 'Campo Auca, Pozo 3',
    clientName: 'Andes Petroleum',
    estimatedDate: '2026-08-20',
    assignedSupervisor: 'C. Herrera',
    assignedOperator: 'J. Paredes',
    unitCode: 'FCR-01',
    currentPhase: 'cierre',
    proposalVersion: 1,
    tools: [
      { id: 10, name: 'Tubería de perforación 5"', status: 'devuelta' },
      { id: 11, name: 'Estabilizador 8 1/2"', status: 'devuelta' },
      { id: 12, name: 'Martillo de fondo', status: 'devuelta' },
      { id: 13, name: 'Broca tricónica 12 1/4"', status: 'faltante', missingReason: 'Venta de herramienta complementaria al cliente' },
    ],
    toolListConfirmed: true,
    inspectionDocumentUploaded: true,
    movementGuideGenerated: true,
    reviewGuideGenerated: true,
    operationalMeetingDate: '2026-08-18T08:00:00.000Z',
    operationalActaSigned: true,
    workReportUploaded: true,
    toolReportUploaded: true,
    finalReviewGuideUploaded: true,
    activityLog: [],
    toolUsageLog: [],
    observations: [],
    reportsApproved: true,
    bodegaExitGuideGenerated: true,
    toolReturnComplete: true,
    surveySent: true,
    phaseHistory: [],
  },
];

function findIndex(id: number): number {
  return tickets.findIndex(t => t.id === id);
}

let nextTicketId = 200;

/**
 * Puente Facturación → FCR: al crear un Pedido cuya línea de servicio se
 * ejecuta por FCR (CTU / Fishing / Completion), se genera acá un ticket
 * FCR vinculado por `pedidoCode`, listo para trabajar desde `validacion`.
 * Al aprobar sus reportes en Revisión de Reportes, `enviarReportesAFacturacion`
 * (ticket-detail-page de FCR) empuja Reporte Job + Reporte de Herramientas
 * de vuelta al Pedido — cerrando el ciclo Pedido → FCR → Facturación.
 */
export function crearTicketFcrParaPedido(input: { pedidoCode: string; cliente: string; pozo: string; estimatedDate: string }): FcrTicket {
  const id = nextTicketId++;
  const ticket: FcrTicket = {
    id,
    code: `FCR-${id}`,
    status: 'en_revision',
    wellName: input.pozo,
    clientName: input.cliente,
    estimatedDate: input.estimatedDate,
    assignedSupervisor: '',
    assignedOperator: '',
    unitCode: '',
    pedidoCode: input.pedidoCode,
    currentPhase: 'validacion',
    proposalVersion: 1,
    tools: [],
    toolListConfirmed: false,
    inspectionDocumentUploaded: false,
    movementGuideGenerated: false,
    reviewGuideGenerated: false,
    operationalMeetingDate: '',
    operationalActaSigned: false,
    workReportUploaded: false,
    toolReportUploaded: false,
    finalReviewGuideUploaded: false,
    activityLog: [],
    toolUsageLog: [],
    observations: [],
    reportsApproved: false,
    bodegaExitGuideGenerated: false,
    toolReturnComplete: false,
    surveySent: false,
    phaseHistory: [],
  };
  tickets = [...tickets, ticket];
  return ticket;
}

/** 'HH:mm' a 'HH:mm' → horas, asumiendo turno que cruza medianoche si fin < inicio (mismo criterio que DYN-SGI-RE-047). */
function calcDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let minutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function respond(idx: number) {
  return of(new HttpResponse({ status: idx !== -1 ? 200 : 404, body: idx !== -1 ? tickets[idx] : null })).pipe(delay(300));
}

export const fcrMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/operations/fcr/tickets' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: tickets })).pipe(delay(400));
  }

  const detailMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)$/);
  if (detailMatch && req.method === 'GET') {
    return respond(findIndex(Number(detailMatch[1])));
  }

  const advanceMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/advance$/);
  if (advanceMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(advanceMatch[1]));
    if (idx !== -1) {
      const { phase, approvedBy, approvedByRole } = req.body as { phase: FcrTicket['currentPhase']; approvedBy: string; approvedByRole: string };
      const t = tickets[idx];
      tickets[idx] = {
        ...t,
        currentPhase: phase,
        phaseHistory: [...t.phaseHistory, { phase, approvedBy, approvedByRole, date: new Date().toISOString().split('T')[0] }],
      };
    }
    return respond(idx);
  }

  const correctionMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/request-correction$/);
  if (correctionMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(correctionMatch[1]));
    if (idx !== -1) {
      const { observations } = req.body as { observations: string };
      const t = tickets[idx];
      tickets[idx] = {
        ...t,
        proposalVersion: t.proposalVersion + 1,
        observations: [...t.observations, { id: t.observations.length + 1, author: t.assignedSupervisor, role: 'Supervisor', date: new Date().toISOString().split('T')[0], message: observations }],
      };
    }
    return respond(idx);
  }

  const resolveCorrectionMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/resolve-correction$/);
  if (resolveCorrectionMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(resolveCorrectionMatch[1]));
    if (idx !== -1) {
      const { resolvedBy, observation } = req.body as { resolvedBy: string; observation: string };
      const t = tickets[idx];
      tickets[idx] = {
        ...t,
        observations: [...t.observations, { id: t.observations.length + 1, author: resolvedBy, role: 'Ingeniería de Ventas', date: new Date().toISOString().split('T')[0], message: observation }],
      };
    }
    return respond(idx);
  }

  // Cada endpoint de herramienta muta solo la herramienta afectada por id —
  // nunca reemplaza el arreglo completo, para que una sesión con la página
  // desactualizada (ej. Bodega sin refrescar) no pise por accidente una
  // herramienta que otra sesión acaba de agregar o modificar.
  const addToolMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools$/);
  if (addToolMatch && req.method === 'POST') {
    const idx = findIndex(Number(addToolMatch[1]));
    if (idx !== -1) {
      const { name } = req.body as { name: string };
      const t = tickets[idx];
      const nextId = Math.max(0, ...tickets.flatMap(ticket => ticket.tools.map(tool => tool.id))) + 1;
      // Si alguna herramienta ya avanzó más allá de "Seleccionada", esta es
      // claramente una adición posterior — se marca para mostrarla aparte
      // en la UI, sin perder el resto del flujo. Agregar nunca se bloquea:
      // el envío a Bodega es por herramienta, no por todo el ticket.
      const addedLate = t.tools.some(tool => tool.status !== 'seleccionada');
      tickets[idx] = { ...t, tools: [...t.tools, { id: nextId, name, status: 'seleccionada', addedLate }] };
    }
    return respond(idx);
  }

  // Envío de un solo sentido, por herramienta: marca "sentToBodega" en cada
  // "Seleccionada" aún no enviada. Nunca se revierte — una herramienta ya
  // enviada no vuelve a ser removible bajo ninguna circunstancia.
  const sendToBodegaMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/send-to-bodega$/);
  if (sendToBodegaMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(sendToBodegaMatch[1]));
    if (idx !== -1) {
      tickets[idx] = {
        ...tickets[idx],
        tools: tickets[idx].tools.map(tool => (tool.status === 'seleccionada' && !tool.sentToBodega ? { ...tool, sentToBodega: true } : tool)),
      };
    }
    return respond(idx);
  }

  const removeToolMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/(\d+)$/);
  if (removeToolMatch && req.method === 'DELETE') {
    const idx = findIndex(Number(removeToolMatch[1]));
    if (idx !== -1) {
      const toolId = Number(removeToolMatch[2]);
      tickets[idx] = { ...tickets[idx], tools: tickets[idx].tools.filter(tool => tool.id !== toolId) };
    }
    return respond(idx);
  }

  const toolStatusMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/(\d+)\/status$/);
  if (toolStatusMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(toolStatusMatch[1]));
    if (idx !== -1) {
      const toolId = Number(toolStatusMatch[2]);
      const { status } = req.body as { status: FcrTool['status'] };
      tickets[idx] = {
        ...tickets[idx],
        tools: tickets[idx].tools.map(tool => {
          if (tool.id !== toolId) return tool;
          // Una corrección de vuelta a "seleccionada" o "en_preparacion"
          // exige un nuevo envío formal — evita que el siguiente rol actúe
          // sobre algo que todavía se está corrigiendo.
          if (status === 'seleccionada') return { ...tool, status, sentToBodega: false };
          if (status === 'en_preparacion') return { ...tool, status, sentToSupervisor: false };
          return { ...tool, status };
        }),
      };
    }
    return respond(idx);
  }

  const sendToSupervisorMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/send-to-supervisor$/);
  if (sendToSupervisorMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(sendToSupervisorMatch[1]));
    if (idx !== -1) {
      tickets[idx] = {
        ...tickets[idx],
        tools: tickets[idx].tools.map(tool => (tool.status === 'en_preparacion' && !tool.sentToSupervisor ? { ...tool, sentToSupervisor: true } : tool)),
      };
    }
    return respond(idx);
  }

  const confirmListMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/confirm-list$/);
  if (confirmListMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(confirmListMatch[1]));
    if (idx !== -1) {
      const { confirmed } = req.body as { confirmed: boolean };
      tickets[idx] = { ...tickets[idx], toolListConfirmed: confirmed };
    }
    return respond(idx);
  }

  const inspectionMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/inspection-document$/);
  if (inspectionMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(inspectionMatch[1]));
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], inspectionDocumentUploaded: true, movementGuideGenerated: true, reviewGuideGenerated: true };
    }
    return respond(idx);
  }

  const assignOperatorMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/assign-operator$/);
  if (assignOperatorMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(assignOperatorMatch[1]));
    if (idx !== -1) {
      const { operatorName } = req.body as { operatorName: string };
      tickets[idx] = { ...tickets[idx], assignedOperator: operatorName };
    }
    return respond(idx);
  }

  const actaMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/confirm-acta$/);
  if (actaMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(actaMatch[1]));
    if (idx !== -1) {
      const { meetingDate } = req.body as { meetingDate: string };
      tickets[idx] = { ...tickets[idx], operationalMeetingDate: meetingDate, operationalActaSigned: true };
    }
    return respond(idx);
  }

  const submitReportsMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/submit-reports$/);
  if (submitReportsMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(submitReportsMatch[1]));
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], workReportUploaded: true, toolReportUploaded: true, finalReviewGuideUploaded: true };
    }
    return respond(idx);
  }

  // Duración calculada acá, no recibida del cliente — nunca se confía en un
  // "durationHours" capturado a mano, siempre se deriva de startTime/endTime.
  const addActivityMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/activity-log$/);
  if (addActivityMatch && req.method === 'POST') {
    const idx = findIndex(Number(addActivityMatch[1]));
    if (idx !== -1) {
      const { date, startTime, endTime, detail, author } = req.body as { date: string; startTime: string; endTime: string; detail: string; author: string };
      const t = tickets[idx];
      const nextId = Math.max(0, ...t.activityLog.map(e => e.id)) + 1;
      const durationHours = calcDurationHours(startTime, endTime);
      tickets[idx] = {
        ...t,
        activityLog: [...t.activityLog, { id: nextId, date, startTime, endTime, durationHours, detail, author }],
      };
    }
    return respond(idx);
  }

  const removeActivityMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/activity-log\/(\d+)$/);
  if (removeActivityMatch && req.method === 'DELETE') {
    const idx = findIndex(Number(removeActivityMatch[1]));
    if (idx !== -1) {
      const entryId = Number(removeActivityMatch[2]);
      tickets[idx] = { ...tickets[idx], activityLog: tickets[idx].activityLog.filter(e => e.id !== entryId) };
    }
    return respond(idx);
  }

  // Registrar de nuevo la misma herramienta+fecha reemplaza el estado de ese
  // día (upsert) en vez de duplicar filas para el mismo día.
  const addToolUsageMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tool-usage$/);
  if (addToolUsageMatch && req.method === 'POST') {
    const idx = findIndex(Number(addToolUsageMatch[1]));
    if (idx !== -1) {
      const { toolId, date, status } = req.body as { toolId: number; date: string; status: FcrTicket['toolUsageLog'][number]['status'] };
      const t = tickets[idx];
      const existing = t.toolUsageLog.find(e => e.toolId === toolId && e.date === date);
      const toolUsageLog = existing
        ? t.toolUsageLog.map(e => (e.id === existing.id ? { ...e, status } : e))
        : [...t.toolUsageLog, { id: Math.max(0, ...t.toolUsageLog.map(e => e.id)) + 1, toolId, date, status }];
      tickets[idx] = { ...t, toolUsageLog };
    }
    return respond(idx);
  }

  const removeToolUsageMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tool-usage\/(\d+)$/);
  if (removeToolUsageMatch && req.method === 'DELETE') {
    const idx = findIndex(Number(removeToolUsageMatch[1]));
    if (idx !== -1) {
      const entryId = Number(removeToolUsageMatch[2]);
      tickets[idx] = { ...tickets[idx], toolUsageLog: tickets[idx].toolUsageLog.filter(e => e.id !== entryId) };
    }
    return respond(idx);
  }

  const reviewReportsMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/review-reports$/);
  if (reviewReportsMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(reviewReportsMatch[1]));
    if (idx !== -1) {
      const { decision, observation } = req.body as { decision: 'approved' | 'rejected'; observation?: string };
      const t = tickets[idx];
      const observations = observation
        ? [...t.observations, { id: t.observations.length + 1, author: t.assignedSupervisor, role: 'Supervisor', date: new Date().toISOString().split('T')[0], message: observation }]
        : t.observations;
      tickets[idx] = { ...t, reportsApproved: decision === 'approved', observations };
    }
    return respond(idx);
  }

  const missingToolMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/(\d+)\/missing$/);
  if (missingToolMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(missingToolMatch[1]));
    if (idx !== -1) {
      const toolId = Number(missingToolMatch[2]);
      const { reason } = req.body as { reason: string };
      tickets[idx] = {
        ...tickets[idx],
        tools: tickets[idx].tools.map(t => (t.id === toolId ? { ...t, status: 'faltante', missingReason: reason } : t)),
      };
    }
    return respond(idx);
  }

  const bodegaExitMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/tools\/(\d+)\/bodega-exit-guide$/);
  if (bodegaExitMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(bodegaExitMatch[1]));
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], bodegaExitGuideGenerated: true };
    }
    return respond(idx);
  }

  const closeMatch = req.url.match(/\/api\/operations\/fcr\/tickets\/(\d+)\/close$/);
  if (closeMatch && req.method === 'PATCH') {
    const idx = findIndex(Number(closeMatch[1]));
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], status: 'cerrado', currentPhase: 'cierre', toolReturnComplete: true, surveySent: true };
    }
    return respond(idx);
  }

  return next(req);
};
