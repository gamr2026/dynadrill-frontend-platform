import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { IpercMatrix } from '../../features/qhse/iperc/models/iperc.model';
import { DEFAULT_LOTO_CHECKLIST, PTW_DOCUMENTOS_REQUERIDOS, PtwMatrix } from '../../features/qhse/ptw/models/ptw.model';

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

  return next(req);
};
