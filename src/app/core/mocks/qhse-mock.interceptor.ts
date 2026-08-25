import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { IpercMatrix } from '../../features/qhse/iperc/models/iperc.model';
import { DEFAULT_LOTO_CHECKLIST, PTW_DOCUMENTOS_REQUERIDOS, PtwMatrix } from '../../features/qhse/ptw/models/ptw.model';
import { CreateStopCardInput, StopCard } from '../../features/qhse/stop/models/stop-card.model';
import { CreateSwaInput, DEFAULT_SWA_REANUDACION_CHECKLIST, SWA_NOTIFICATION_ROLES, SwaEvento } from '../../features/qhse/swa/models/swa.model';
import { CreateInspeccionInput, InspeccionEquipo, inspeccionVigenciaHasta } from '../../features/qhse/inspecciones/models/inspeccion-equipo.model';
import { CreateDesechoInput, Desecho, desechoLimiteAlmacenamiento } from '../../features/qhse/desechos/models/desecho.model';
import {
  CreateDerrameInput,
  DEFAULT_CONTENCION_CHECKLIST,
  DerrameEvento,
} from '../../features/qhse/derrames/models/derrame.model';
import {
  CreateEmergenciaInput,
  DEFAULT_EMERGENCIA_NOTIFICACIONES,
  EmergenciaEvento,
} from '../../features/qhse/emergencias/models/emergencia.model';
import { CreateInvestigacionInput, DEFAULT_ISHIKAWA, Investigacion } from '../../features/qhse/investigaciones/models/investigacion.model';

/**
 * Solo activo mientras no exista el backend real de QHSE — mismo patrón
 * que pumping-mock.interceptor.ts / maintenance-mock.interceptor.ts.
 * Borrar junto con su registro en app.config.ts cuando /api/qhse exista de
 * verdad.
 */
let matrices: IpercMatrix[] = [
  {
    id: 1,
    code: 'DYN-SGI-RE-087-2026-014',
    status: 'en_revision',
    actividad: 'Mantenimiento de bomba de transferencia de crudo',
    ubicacion: 'Pozo Delta-7',
    equipoEvaluador: ['Luis Vega (Supervisor)', 'Ana Torres (Técnico HSE)'],
    atsGenerado: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-18T10:00:00.000Z',
    tasks: [
      {
        id: 1,
        descripcion: 'Bloqueo y aislamiento de energía (LOTO) de la bomba',
        hazards: [
          {
            id: 1,
            peligro: 'Contacto con partes en movimiento',
            fuenteRiesgo: 'Acople y eje de la bomba sin bloqueo verificado',
            controlesExistentes: 'Procedimiento LOTO general de la empresa',
            probabilidadInicial: 3,
            severidadInicial: 4,
            probabilidadResidual: 2,
            severidadResidual: 4,
            controles: [
              { id: 1, type: 'administrativo', description: 'Verificación de cero energía con dos personas antes de intervenir' },
              { id: 2, type: 'epp', description: 'Guantes anticorte y gafas de seguridad' },
            ],
          },
        ],
      },
      {
        id: 2,
        descripcion: 'Desmontaje y limpieza de sello mecánico',
        hazards: [
          {
            id: 2,
            peligro: 'Exposición a hidrocarburo residual',
            fuenteRiesgo: 'Fluido remanente en carcasa de la bomba',
            controlesExistentes: 'Ninguno',
            probabilidadInicial: 4,
            severidadInicial: 3,
            probabilidadResidual: 2,
            severidadResidual: 3,
            controles: [
              { id: 3, type: 'ingenieria', description: 'Drenaje a contenedor cerrado antes de abrir la carcasa' },
              { id: 4, type: 'epp', description: 'Traje Tyvek y respirador con filtro para vapores orgánicos' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 2,
    code: 'DYN-SGI-RE-087-2026-015',
    status: 'borrador',
    actividad: 'Instalación de línea de flujo temporal',
    ubicacion: 'Pozo Alfa-3',
    equipoEvaluador: ['Ana Ruiz (Supervisor)'],
    atsGenerado: false,
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    tasks: [
      {
        id: 3,
        descripcion: 'Tendido y acople de tubería temporal',
        hazards: [
          {
            id: 3,
            peligro: 'Golpes y atrapamiento durante el izaje de tubería',
            fuenteRiesgo: 'Manipulación manual de tramos de tubería',
            controlesExistentes: '',
            probabilidadInicial: null,
            severidadInicial: null,
            probabilidadResidual: null,
            severidadResidual: null,
            controles: [],
          },
        ],
      },
    ],
  },
  {
    id: 3,
    code: 'DYN-SGI-RE-087-2026-009',
    status: 'aprobada',
    actividad: 'Inspección y purga de separador de producción',
    ubicacion: 'Pozo Beta-9',
    equipoEvaluador: ['Ana Torres (Técnico HSE)', 'Jorge Hidalgo (Coordinador HSE)'],
    atsGenerado: true,
    approvedByName: 'Jorge Hidalgo',
    approvedAt: '2026-08-10T15:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-08-10T15:00:00.000Z',
    tasks: [
      {
        id: 4,
        descripcion: 'Purga de gas residual antes de apertura',
        hazards: [
          {
            id: 4,
            peligro: 'Presencia de H2S en purga',
            fuenteRiesgo: 'Gas asociado remanente en el separador',
            controlesExistentes: 'Monitoreo con detector personal',
            probabilidadInicial: 3,
            severidadInicial: 5,
            probabilidadResidual: 1,
            severidadResidual: 5,
            controles: [
              { id: 5, type: 'ingenieria', description: 'Purga dirigida a antorcha, nunca a la atmósfera del área de trabajo' },
              { id: 6, type: 'administrativo', description: 'Monitoreo continuo de H2S durante toda la purga' },
              { id: 7, type: 'epp', description: 'SCBA disponible en sitio para respuesta inmediata' },
            ],
          },
        ],
      },
    ],
  },
];

function nuevosDocumentosRequeridos() {
  return PTW_DOCUMENTOS_REQUERIDOS.map(d => ({ ...d, cargado: false }));
}

let ptwRecords: PtwMatrix[] = [
  {
    id: 1,
    code: 'PTW-2026-0031',
    fase: 'verificaciones',
    ordenTrabajo: 'OT-2026-0301',
    actividad: 'Inspección y purga de separador de producción',
    ubicacion: 'Pozo Beta-9',
    ipercMatrixId: 3,
    ipercCode: 'DYN-SGI-RE-087-2026-009',
    documentos: PTW_DOCUMENTOS_REQUERIDOS.map(d => ({
      ...d,
      cargado: true,
      fileName: `${d.tipo}.pdf`,
      cargadoAt: '2026-08-22T09:00:00.000Z',
    })),
    toolboxTalkRealizado: true,
    walkaroundCompletado: true,
    lineaBaseAmbientalDocumentada: true,
    rutasEmergenciaVerificadas: true,
    simopsConfirmado: true,
    gasReadings: [
      { gas: 'H2S', lectura: 2, seguro: true, medidoAt: '2026-08-22T13:00:00.000Z' },
      { gas: 'LEL', lectura: 4, seguro: true, medidoAt: '2026-08-22T13:00:00.000Z' },
      { gas: 'O2', lectura: 20.9, seguro: true, medidoAt: '2026-08-22T13:00:00.000Z' },
      { gas: 'CO', lectura: 32, seguro: false, medidoAt: '2026-08-22T13:00:00.000Z' },
    ],
    lotoChecklist: DEFAULT_LOTO_CHECKLIST.map(i => ({ ...i, checked: true })),
    barricadasInstaladas: false,
    limpiezaCompletada: false,
    inspeccionFinalConforme: false,
    respaldosEnviados: false,
    createdAt: '2026-08-22T08:00:00.000Z',
    updatedAt: '2026-08-22T13:00:00.000Z',
  },
];

let nextPtwId = 2;

function nextPtwCode(): string {
  const year = new Date().getFullYear();
  const seq = String(nextPtwId).padStart(4, '0');
  return `PTW-${year}-${seq}`;
}

let stopCards: StopCard[] = [
  {
    id: 1,
    code: 'STOP-2026-0089',
    tipo: 'condicion_insegura',
    categorias: ['Orden y limpieza', 'EPP'],
    descripcion: 'Cables de extensión sobre el paso peatonal de la locación, sin protección.',
    riesgoPotencial: 'Tropiezo/caída de personal en tránsito.',
    accionCorrectivaInmediata: 'Se reubicaron los cables y se instaló canaleta pasacables.',
    observadorNombre: 'Ana Torres',
    observadoNombre: 'Cuadrilla de electricidad',
    ubicacion: 'Pozo Beta-9',
    createdAt: '2026-08-20T10:15:00.000Z',
  },
];
let nextStopId = 2;

function nextStopCode(): string {
  const year = new Date().getFullYear();
  return `STOP-${year}-${String(nextStopId).padStart(4, '0')}`;
}

let swaEventos: SwaEvento[] = [];
let nextSwaId = 1;

function nextSwaCode(): string {
  const year = new Date().getFullYear();
  return `SWA-${year}-${String(nextSwaId).padStart(4, '0')}`;
}

let inspecciones: InspeccionEquipo[] = [];
let nextInspeccionId = 1;

function nextInspeccionCode(): string {
  const year = new Date().getFullYear();
  return `INSP-${year}-${String(nextInspeccionId).padStart(4, '0')}`;
}

let desechos: Desecho[] = [];
let nextDesechoId = 1;

function nextDesechoCode(): string {
  const year = new Date().getFullYear();
  return `RES-${year}-${String(nextDesechoId).padStart(4, '0')}`;
}

let derrames: DerrameEvento[] = [];
let nextDerrameId = 1;

function nextDerrameCode(): string {
  const year = new Date().getFullYear();
  return `DER-${year}-${String(nextDerrameId).padStart(4, '0')}`;
}

let emergencias: EmergenciaEvento[] = [];
let nextEmergenciaId = 1;

function nextEmergenciaCode(): string {
  const year = new Date().getFullYear();
  return `EMG-${year}-${String(nextEmergenciaId).padStart(4, '0')}`;
}

let investigaciones: Investigacion[] = [];
let nextInvestigacionId = 1;

function nextInvestigacionCode(): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(nextInvestigacionId).padStart(4, '0')}`;
}

/** HSE-MASTER-001 — metas por KPI que el staff HSE define para el semáforo del Dashboard Integrado; sin persistencia real detrás, solo en memoria como el resto del mock. */
let dashboardMetas: Record<string, number> = {};

export const qhseMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/qhse/iperc' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: matrices })).pipe(delay(400));
  }

  const approveMatch = req.url.match(/\/api\/qhse\/iperc\/(\d+)\/approve$/);
  if (approveMatch && req.method === 'PATCH') {
    const id = Number(approveMatch[1]);
    const idx = matrices.findIndex(m => m.id === id);
    if (idx !== -1) {
      const { approvedByName } = req.body as { approvedByName: string };
      const updated: IpercMatrix = {
        ...matrices[idx],
        status: 'aprobada',
        approvedByName,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      matrices = matrices.map(m => (m.id === id ? updated : m));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  const ipercDetailMatch = req.url.match(/\/api\/qhse\/iperc\/(\d+)$/);
  if (ipercDetailMatch && req.method === 'GET') {
    const id = Number(ipercDetailMatch[1]);
    const found = matrices.find(m => m.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (ipercDetailMatch && req.method === 'PATCH') {
    const id = Number(ipercDetailMatch[1]);
    const idx = matrices.findIndex(m => m.id === id);
    if (idx !== -1) {
      const updated: IpercMatrix = {
        ...matrices[idx],
        ...(req.body as Partial<IpercMatrix>),
        updatedAt: new Date().toISOString(),
      };
      matrices = matrices.map(m => (m.id === id ? updated : m));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-SITIO-001: Recibimiento de Sitio y Apertura de PTW ---

  if (req.url === '/api/qhse/ptw' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: ptwRecords })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/ptw' && req.method === 'POST') {
    const { ipercMatrixId } = req.body as { ipercMatrixId: number };
    const iperc = matrices.find(m => m.id === ipercMatrixId);

    /**
     * HSE-MASTER-001: "Sin IPERC aprobado el sistema bloquea la apertura
     * del PTW" — integración automática entre HSE-PLAN-001 y HSE-SITIO-001.
     */
    if (!iperc || iperc.status !== 'aprobada') {
      return of(
        new HttpResponse({
          status: 400,
          body: { message: 'No se puede abrir un PTW sin una Matriz IPERC aprobada.' } as unknown,
        }),
      ).pipe(delay(300));
    }

    const now = new Date().toISOString();
    const created: PtwMatrix = {
      id: nextPtwId,
      code: nextPtwCode(),
      fase: 'gabinete',
      ordenTrabajo: `OT-${nextPtwCode().replace('PTW-', '')}`,
      actividad: iperc.actividad,
      ubicacion: iperc.ubicacion,
      ipercMatrixId: iperc.id,
      ipercCode: iperc.code,
      documentos: nuevosDocumentosRequeridos(),
      toolboxTalkRealizado: false,
      walkaroundCompletado: false,
      lineaBaseAmbientalDocumentada: false,
      rutasEmergenciaVerificadas: false,
      simopsConfirmado: false,
      gasReadings: [],
      lotoChecklist: DEFAULT_LOTO_CHECKLIST.map(i => ({ ...i })),
      barricadasInstaladas: false,
      limpiezaCompletada: false,
      inspeccionFinalConforme: false,
      respaldosEnviados: false,
      createdAt: now,
      updatedAt: now,
    };
    ptwRecords = [...ptwRecords, created];
    nextPtwId += 1;

    // El ATS base queda generado a partir de la matriz al abrir el PTW que lo consume (HSE-PLAN-001, campo atsGenerado).
    matrices = matrices.map(m => (m.id === iperc.id ? { ...m, atsGenerado: true, updatedAt: now } : m));

    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const ptwDetailMatch = req.url.match(/\/api\/qhse\/ptw\/(\d+)$/);
  if (ptwDetailMatch && req.method === 'GET') {
    const id = Number(ptwDetailMatch[1]);
    const found = ptwRecords.find(p => p.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (ptwDetailMatch && req.method === 'PATCH') {
    const id = Number(ptwDetailMatch[1]);
    const idx = ptwRecords.findIndex(p => p.id === id);
    if (idx !== -1) {
      const updated: PtwMatrix = {
        ...ptwRecords[idx],
        ...(req.body as Partial<PtwMatrix>),
        updatedAt: new Date().toISOString(),
      };
      ptwRecords = ptwRecords.map(p => (p.id === id ? updated : p));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-SEGUIMIENTO-002: Tarjetas STOP ---

  if (req.url === '/api/qhse/stop' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: stopCards })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/stop' && req.method === 'POST') {
    const input = req.body as CreateStopCardInput;
    const created: StopCard = { ...input, id: nextStopId, code: nextStopCode(), createdAt: new Date().toISOString() };
    stopCards = [...stopCards, created];
    nextStopId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  // --- HSE-SEGUIMIENTO-003: Stop Work Authority ---

  if (req.url === '/api/qhse/swa' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: swaEventos })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/swa' && req.method === 'POST') {
    const input = req.body as CreateSwaInput;
    const now = new Date().toISOString();
    const created: SwaEvento = {
      ...input,
      id: nextSwaId,
      code: nextSwaCode(),
      estado: 'activo',
      activadoAt: now,
      notificaciones: SWA_NOTIFICATION_ROLES.map(rol => ({ rol })),
      riesgoReal: null,
      checklistReanudacion: DEFAULT_SWA_REANUDACION_CHECKLIST.map(i => ({ ...i })),
      heroeSeguridad: false,
    };
    swaEventos = [...swaEventos, created];
    nextSwaId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const swaDetailMatch = req.url.match(/\/api\/qhse\/swa\/(\d+)$/);
  if (swaDetailMatch && req.method === 'GET') {
    const id = Number(swaDetailMatch[1]);
    const found = swaEventos.find(s => s.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (swaDetailMatch && req.method === 'PATCH') {
    const id = Number(swaDetailMatch[1]);
    const idx = swaEventos.findIndex(s => s.id === id);
    if (idx !== -1) {
      const updated: SwaEvento = { ...swaEventos[idx], ...(req.body as Partial<SwaEvento>) };
      swaEventos = swaEventos.map(s => (s.id === id ? updated : s));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-SEGUIMIENTO-001: Inspecciones de campo ---

  if (req.url === '/api/qhse/inspecciones' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: inspecciones })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/inspecciones' && req.method === 'POST') {
    const input = req.body as CreateInspeccionInput;
    const created: InspeccionEquipo = {
      ...input,
      id: nextInspeccionId,
      code: nextInspeccionCode(),
      vigenciaHasta: inspeccionVigenciaHasta(input.fecha),
    };
    inspecciones = [...inspecciones, created];
    nextInspeccionId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  // --- HSE-AMBIENTAL-001: Gestión de desechos ---

  if (req.url === '/api/qhse/desechos' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: desechos })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/desechos' && req.method === 'POST') {
    const input = req.body as CreateDesechoInput;
    const now = new Date().toISOString();
    const created: Desecho = {
      ...input,
      id: nextDesechoId,
      code: nextDesechoCode(),
      estado: 'almacenado',
      createdAt: now,
      limiteAlmacenamientoHasta: desechoLimiteAlmacenamiento(now),
    };
    desechos = [...desechos, created];
    nextDesechoId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const desechoDetailMatch = req.url.match(/\/api\/qhse\/desechos\/(\d+)$/);
  if (desechoDetailMatch && req.method === 'GET') {
    const id = Number(desechoDetailMatch[1]);
    const found = desechos.find(d => d.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (desechoDetailMatch && req.method === 'PATCH') {
    const id = Number(desechoDetailMatch[1]);
    const idx = desechos.findIndex(d => d.id === id);
    if (idx !== -1) {
      const updated: Desecho = { ...desechos[idx], ...(req.body as Partial<Desecho>) };
      desechos = desechos.map(d => (d.id === id ? updated : d));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-AMBIENTAL-002: Control y respuesta a derrames ---

  if (req.url === '/api/qhse/derrames' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: derrames })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/derrames' && req.method === 'POST') {
    const input = req.body as CreateDerrameInput;
    const created: DerrameEvento = {
      ...input,
      id: nextDerrameId,
      code: nextDerrameCode(),
      estado: 'activo',
      activadoAt: new Date().toISOString(),
      checklistContencion: DEFAULT_CONTENCION_CHECKLIST.map(i => ({ ...i })),
      notificadoMae: false,
    };
    derrames = [...derrames, created];
    nextDerrameId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const derrameDetailMatch = req.url.match(/\/api\/qhse\/derrames\/(\d+)$/);
  if (derrameDetailMatch && req.method === 'GET') {
    const id = Number(derrameDetailMatch[1]);
    const found = derrames.find(d => d.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (derrameDetailMatch && req.method === 'PATCH') {
    const id = Number(derrameDetailMatch[1]);
    const idx = derrames.findIndex(d => d.id === id);
    if (idx !== -1) {
      const updated: DerrameEvento = { ...derrames[idx], ...(req.body as Partial<DerrameEvento>) };
      derrames = derrames.map(d => (d.id === id ? updated : d));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  const generarDesechoMatch = req.url.match(/\/api\/qhse\/derrames\/(\d+)\/generar-desecho$/);
  if (generarDesechoMatch && req.method === 'POST') {
    const id = Number(generarDesechoMatch[1]);
    const derrame = derrames.find(d => d.id === id);
    if (!derrame) return of(new HttpResponse({ status: 404 })).pipe(delay(300));

    const now = new Date().toISOString();
    const desecho: Desecho = {
      id: nextDesechoId,
      code: nextDesechoCode(),
      clasificacion: 'peligroso',
      cretib: ['Tóxico'],
      contenedorColor: 'negro',
      descripcion: `Suelo contaminado por derrame ${derrame.code} (${derrame.descripcion})`,
      pesoKg: 0,
      ubicacion: derrame.ubicacionFisica,
      generadoPorNombre: derrame.activadoPorNombre,
      estado: 'almacenado',
      createdAt: now,
      limiteAlmacenamientoHasta: desechoLimiteAlmacenamiento(now),
    };
    desechos = [...desechos, desecho];
    nextDesechoId += 1;

    const updatedDerrame: DerrameEvento = { ...derrame, desechoGeneradoId: desecho.id };
    derrames = derrames.map(d => (d.id === id ? updatedDerrame : d));

    return of(new HttpResponse({ status: 200, body: updatedDerrame })).pipe(delay(400));
  }

  // --- HSE-TRIAGE-001: Plan de Respuesta a Emergencias y MEDEVAC ---

  if (req.url === '/api/qhse/emergencias' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: emergencias })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/emergencias' && req.method === 'POST') {
    const input = req.body as CreateEmergenciaInput;
    const now = new Date().toISOString();
    const created: EmergenciaEvento = {
      ...input,
      id: nextEmergenciaId,
      code: nextEmergenciaCode(),
      nivel: null,
      estado: 'activa',
      activadoAt: now,
      timeline: [{ timestamp: now, evento: 'Emergencia detectada y activada' }],
      conteoPersonal: { totalEnLocacion: 0, evacuados: 0 },
      heridos: [],
      notificaciones: DEFAULT_EMERGENCIA_NOTIFICACIONES.map(n => ({ ...n })),
      reporteFlash: { resumenEjecutivo: '', personalAfectado: '', accionesTomadas: '', estadoActual: '', proximosPasos: '' },
    };
    emergencias = [...emergencias, created];
    nextEmergenciaId += 1;
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const emergenciaDetailMatch = req.url.match(/\/api\/qhse\/emergencias\/(\d+)$/);
  if (emergenciaDetailMatch && req.method === 'GET') {
    const id = Number(emergenciaDetailMatch[1]);
    const found = emergencias.find(e => e.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (emergenciaDetailMatch && req.method === 'PATCH') {
    const id = Number(emergenciaDetailMatch[1]);
    const idx = emergencias.findIndex(e => e.id === id);
    if (idx !== -1) {
      const updated: EmergenciaEvento = { ...emergencias[idx], ...(req.body as Partial<EmergenciaEvento>) };
      emergencias = emergencias.map(e => (e.id === id ? updated : e));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-TRIAGE-002: Investigación de Incidentes y Casi Accidentes ---

  if (req.url === '/api/qhse/investigaciones' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: investigaciones })).pipe(delay(400));
  }

  if (req.url === '/api/qhse/investigaciones' && req.method === 'POST') {
    const input = req.body as CreateInvestigacionInput;
    const now = new Date().toISOString();
    const created: Investigacion = {
      ...input,
      id: nextInvestigacionId,
      code: nextInvestigacionCode(),
      estado: 'abierta',
      equipoInvestigador: [],
      evidenciasRecopiladas: '',
      testimoniosResumen: '',
      cincoPorques: [],
      ishikawa: { ...DEFAULT_ISHIKAWA },
      causasRaiz: '',
      acciones: [],
      notificacionLegal: { requerida: false },
      leccionesAprendidas: '',
      createdAt: now,
    };
    investigaciones = [...investigaciones, created];
    nextInvestigacionId += 1;

    if (input.origenEmergenciaId) {
      const idx = emergencias.findIndex(e => e.id === input.origenEmergenciaId);
      if (idx !== -1) {
        emergencias = emergencias.map(e => (e.id === input.origenEmergenciaId ? { ...e, investigacionId: created.id } : e));
      }
    }

    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const investigacionDetailMatch = req.url.match(/\/api\/qhse\/investigaciones\/(\d+)$/);
  if (investigacionDetailMatch && req.method === 'GET') {
    const id = Number(investigacionDetailMatch[1]);
    const found = investigaciones.find(i => i.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (investigacionDetailMatch && req.method === 'PATCH') {
    const id = Number(investigacionDetailMatch[1]);
    const idx = investigaciones.findIndex(i => i.id === id);
    if (idx !== -1) {
      const changes = req.body as Partial<Investigacion>;
      const updated: Investigacion = { ...investigaciones[idx], ...changes };
      investigaciones = investigaciones.map(i => (i.id === id ? updated : i));

      /**
       * HSE-MASTER-001 — al cerrar la investigación con una matriz IPERC
       * marcada, se retroalimenta esa matriz de verdad (no un banner):
       * queda lista para que HSE-PLAN-001 la revise con la lección ya
       * redactada.
       */
      if (changes.estado === 'cerrada' && updated.ipercActualizadoId) {
        const mIdx = matrices.findIndex(m => m.id === updated.ipercActualizadoId);
        if (mIdx !== -1) {
          const updatedMatrix: IpercMatrix = {
            ...matrices[mIdx],
            leccionAprendidaPendiente: true,
            leccionAprendidaTexto: updated.leccionesAprendidas,
            leccionAprendidaInvestigacionCode: updated.code,
            updatedAt: new Date().toISOString(),
          };
          matrices = matrices.map(m => (m.id === updated.ipercActualizadoId ? updatedMatrix : m));
        }
      }

      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  // --- HSE-MASTER-001: Dashboard Integrado (metas del semáforo) ---

  if (req.url === '/api/qhse/dashboard-metas' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: dashboardMetas })).pipe(delay(200));
  }

  if (req.url === '/api/qhse/dashboard-metas' && req.method === 'PATCH') {
    dashboardMetas = { ...dashboardMetas, ...(req.body as Record<string, number>) };
    return of(new HttpResponse({ status: 200, body: dashboardMetas })).pipe(delay(200));
  }

  return next(req);
};
