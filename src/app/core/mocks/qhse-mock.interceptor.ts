import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { IpercMatrix } from '../../features/qhse/iperc/models/iperc.model';

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

  const detailMatch = req.url.match(/\/api\/qhse\/iperc\/(\d+)$/);
  if (detailMatch && req.method === 'GET') {
    const id = Number(detailMatch[1]);
    const found = matrices.find(m => m.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (detailMatch && req.method === 'PATCH') {
    const id = Number(detailMatch[1]);
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

  return next(req);
};
