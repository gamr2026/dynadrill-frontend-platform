import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import {
  PumpingTicket,
  PumpingUnitReport,
  createChassisInspectionItems,
  createMotorInspectionItems,
  createArrivalEquipmentItems,
  createInstrumentationItems,
  type TireEntry,
} from '../../features/operations/pumping/models/pumping.model';

const defaultTires: TireEntry[] = [
  { axle: 'A', salida: '', llegada: '' },
  { axle: 'B', salida: '', llegada: '' },
  { axle: 'C', salida: '', llegada: '' },
  { axle: 'D', salida: '', llegada: '' },
];

let tickets: PumpingTicket[] = [
  {
    id: 1,
    code: 'PUMP-2026-00456',
    status: 'en_ejecucion',
    wellName: 'Pozo Delta-7',
    clientName: 'Petroandina',
    estimatedDate: '2026-08-08',
    assignedSupervisor: 'Luis Vega',
    assignedOperator: 'Jorge Salinas',
    unitCode: 'PUM-07',
    serviceType: 'coiled_tubing',
    proposalOrigin: 'AS2',
    currentStep: 'en_ejecucion',
    operators: [
      { id: 1, name: 'Jorge Salinas', role: 'Operador Mecánico', unitCode: 'PUM-07' },
      { id: 2, name: 'David Cevallos', role: 'Operador Instrumental', unitCode: 'PUM-07' },
    ],
    unitReport: null,
    chemicals: [
      { id: 1, name: 'Biocida QX-12', quantityAssigned: 40, quantityUsed: 32, quantityReturned: 8, unit: 'gal' },
      { id: 2, name: 'Inhibidor de corrosión', quantityAssigned: 20, quantityUsed: 20, quantityReturned: 0, unit: 'gal' },
    ],
    tools: [
      { id: 1, name: 'Broca tricónica', serialCode: 'DG-0452', status: 'instalada' },
      { id: 2, name: 'Estabilizador', serialCode: 'DG-0780', status: 'instalada' },
    ],
  },
  {
    id: 2,
    code: 'PUMP-2026-00457',
    status: 'en_revision',
    wellName: 'Pozo Alfa-3',
    clientName: 'Operadora XYZ S.A.',
    estimatedDate: '2026-08-15',
    assignedSupervisor: '',
    assignedOperator: '',
    unitCode: '',
    serviceType: 'fluidos_control',
    proposalOrigin: 'AS2',
    currentStep: 'revision_propuesta',
    operators: [],
    unitReport: null,
    chemicals: [],
    tools: [],
  },
  {
    id: 3,
    code: 'PUMP-2026-00458',
    status: 'aprobado',
    wellName: 'Pozo Beta-9',
    clientName: 'Petroecuador',
    estimatedDate: '2026-08-20',
    assignedSupervisor: 'Ana Ruiz',
    assignedOperator: 'Carlos Vega',
    unitCode: 'PUM-15',
    serviceType: 'cementacion_remedial',
    proposalOrigin: 'AS2',
    currentStep: 'en_revision',
    operators: [
      { id: 3, name: 'Carlos Vega', role: 'Operador Mecánico', unitCode: 'PUM-15' },
    ],
    unitReport: {
      reportCode: 'RU-2026-00458',
      unitCode: 'PUM-15',
      wellName: 'Pozo Beta-9',
      baseName: 'Coco',
      blockName: '56',
      headerCode: 'DY-CTV-03',
      clientName: 'Petroecuador',
      departureDate: '2026-08-18',
      arrivalDate: '2026-08-20',
      fuelDeparture: 80,
      fuelArrival: 45,
      hubodometro: [
        { label: 'A', salida: 5570, llegada: 5720 },
        { label: 'B', salida: 4550036, llegada: 4550190 },
        { label: 'C', salida: null, llegada: null },
        { label: 'D', salida: null, llegada: null },
      ],
      tires: defaultTires,
      origin: 'Base Coco',
      destination: 'Pozo Beta-9',
      chassisInspection: createChassisInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      motorInspection: createMotorInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      arrivalEquipmentInspection: createArrivalEquipmentItems().map(i => ({ ...i, llegada: 'ok' as const })),
      instrumentationInspection: createInstrumentationItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      novelties: {
        mecanica: '',
        instrumentacion: '',
        operaciones: '',
      },
      unitReady: true,
      operationInterrupted: false,
      interruptionDetail: '',
      departureOperatorName: 'Carlos Vega',
      arrivalOperatorName: 'Carlos Vega',
    },
    chemicals: [
      { id: 3, name: 'Surfactante SF-3', quantityAssigned: 15, quantityUsed: 12, quantityReturned: 3, unit: 'gal' },
    ],
    tools: [
      { id: 4, name: 'Válvulas de 2"', serialCode: 'VL-2034', status: 'devuelta' },
    ],
  },
  {
    id: 4,
    code: 'PUMP-2026-00459',
    status: 'en_ejecucion',
    wellName: 'Pozo Gamma-2',
    clientName: 'Operadora A',
    estimatedDate: '2026-08-12',
    assignedSupervisor: 'Luis Vega',
    assignedOperator: 'David Cevallos',
    unitCode: '4-CTV-03',
    serviceType: 'estimulaciones',
    proposalOrigin: 'AS2',
    currentStep: 'asignacion',
    operators: [],
    unitReport: null,
    chemicals: [],
    tools: [],
  },
  {
    id: 5,
    code: 'PUMP-2026-00460',
    status: 'en_revision',
    wellName: 'Pozo ABC-15',
    clientName: 'Operadora B',
    estimatedDate: '2026-09-01',
    assignedSupervisor: '',
    assignedOperator: '',
    unitCode: '',
    serviceType: 'servicios_nitrogeno',
    proposalOrigin: 'AS2',
    currentStep: 'revision_propuesta',
    operators: [],
    unitReport: null,
    chemicals: [],
    tools: [],
  },
  {
    id: 6,
    code: 'PUMP-2026-00461',
    status: 'aprobado',
    wellName: 'Pozo Delta-7',
    clientName: 'Petroandina',
    estimatedDate: '2026-08-25',
    assignedSupervisor: 'Ana Ruiz',
    assignedOperator: 'Marcos Torres',
    unitCode: 'PUM-07',
    serviceType: 'coiled_tubing',
    proposalOrigin: 'AS2',
    currentStep: 'en_revision',
    operators: [
      { id: 4, name: 'Marcos Torres', role: 'Operador Mecánico', unitCode: 'PUM-07' },
    ],
    unitReport: {
      reportCode: 'RU-2026-00461',
      unitCode: 'PUM-07',
      wellName: 'Pozo Delta-7',
      baseName: 'Coco',
      blockName: '43',
      headerCode: 'DY-CTV-07',
      clientName: 'Petroandina',
      departureDate: '2026-08-23',
      arrivalDate: '2026-08-25',
      fuelDeparture: 90,
      fuelArrival: 50,
      hubodometro: [
        { label: 'A', salida: 3100, llegada: 3380 },
        { label: 'B', salida: null, llegada: null },
        { label: 'C', salida: null, llegada: null },
        { label: 'D', salida: null, llegada: null },
      ],
      tires: defaultTires,
      origin: 'Base Coco',
      destination: 'Pozo Delta-7',
      chassisInspection: createChassisInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      motorInspection: createMotorInspectionItems().map((i, idx) => ({
        ...i,
        salida: 'ok' as const,
        llegada: idx === 4 ? 'defectuoso' as const : 'ok' as const,
      })),
      arrivalEquipmentInspection: createArrivalEquipmentItems().map(i => ({ ...i, llegada: 'ok' as const })),
      instrumentationInspection: createInstrumentationItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      novelties: {
        mecanica: 'Fuga de aceite en área de freno. Sello desgastado por uso prolongado.',
        instrumentacion: 'Display de cabina no funciona.',
        operaciones: '',
      },
      unitReady: false,
      operationInterrupted: false,
      interruptionDetail: '',
      departureOperatorName: 'Marcos Torres',
      arrivalOperatorName: 'Marcos Torres',
    },
    chemicals: [
      { id: 4, name: 'Fosfato', quantityAssigned: 10, quantityUsed: 8, quantityReturned: 2, unit: 'gal' },
    ],
    tools: [],
  },
  {
    id: 7,
    code: 'PUMP-2026-00462',
    status: 'en_ejecucion',
    wellName: 'Pozo Alfa-3',
    clientName: 'Operadora C',
    estimatedDate: '2026-09-05',
    assignedSupervisor: 'Luis Vega',
    assignedOperator: '',
    unitCode: '',
    serviceType: 'fluidos_control',
    proposalOrigin: 'AS2',
    currentStep: 'asignacion',
    operators: [],
    unitReport: null,
    chemicals: [],
    tools: [],
  },
  {
    id: 8,
    code: 'PUMP-2026-00463',
    status: 'en_ejecucion',
    wellName: 'Pozo Beta-9',
    clientName: 'Petroecuador',
    estimatedDate: '2026-08-18',
    assignedSupervisor: 'Ana Ruiz',
    assignedOperator: 'Carla Fiallos',
    unitCode: 'PUM-15',
    serviceType: 'cementacion_remedial',
    proposalOrigin: 'AS2',
    currentStep: 'en_ejecucion_llegada',
    operators: [
      { id: 5, name: 'Carla Fiallos', role: 'Operador Instrumental', unitCode: 'PUM-15' },
      { id: 6, name: 'Carlos Vega', role: 'Operador Mecánico', unitCode: 'PUM-15' },
    ],
    unitReport: {
      reportCode: 'RU-2026-00463',
      unitCode: 'PUM-15',
      wellName: 'Pozo Beta-9',
      baseName: 'Coco',
      blockName: '56',
      headerCode: 'DY-CTV-03',
      clientName: 'Petroecuador',
      departureDate: '2026-08-16',
      arrivalDate: '2026-08-18',
      fuelDeparture: 75,
      fuelArrival: 40,
      hubodometro: [
        { label: 'A', salida: 5720, llegada: 5900 },
        { label: 'B', salida: 4550190, llegada: 4550350 },
        { label: 'C', salida: null, llegada: null },
        { label: 'D', salida: null, llegada: null },
      ],
      tires: defaultTires,
      origin: 'Base Coco',
      destination: 'Pozo Beta-9',
      chassisInspection: createChassisInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      motorInspection: createMotorInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      arrivalEquipmentInspection: createArrivalEquipmentItems().map(i => ({ ...i, llegada: 'ok' as const })),
      instrumentationInspection: createInstrumentationItems().map(i => ({ ...i, salida: 'ok' as const, llegada: 'ok' as const })),
      novelties: {
        mecanica: '',
        instrumentacion: '',
        operaciones: '',
      },
      unitReady: true,
      operationInterrupted: false,
      interruptionDetail: '',
      departureOperatorName: 'Carla Fiallos',
      arrivalOperatorName: 'Carlos Vega',
    },
    chemicals: [
      { id: 5, name: 'Amonio', quantityAssigned: 25, quantityUsed: 20, quantityReturned: 5, unit: 'gal' },
    ],
    tools: [],
  },
];

export const pumpingMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/operations/pumping/tickets' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: tickets })).pipe(delay(400));
  }

  const detailMatch = req.url.match(/\/api\/operations\/pumping\/tickets\/(\d+)$/);
  if (detailMatch && req.method === 'GET') {
    const id = Number(detailMatch[1]);
    const found = tickets.find(t => t.id === id);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  const advanceMatch = req.url.match(/\/api\/operations\/pumping\/tickets\/(\d+)\/advance$/);
  if (advanceMatch && req.method === 'PATCH') {
    const id = Number(advanceMatch[1]);
    const idx = tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      const { step } = req.body as { step: PumpingTicket['currentStep'] };
      const updated: PumpingTicket = { ...tickets[idx], currentStep: step };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  const unitReportMatch = req.url.match(/\/api\/operations\/pumping\/tickets\/(\d+)\/unit-report$/);
  if (unitReportMatch && req.method === 'PATCH') {
    const id = Number(unitReportMatch[1]);
    const idx = tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      const updated: PumpingTicket = { ...tickets[idx], unitReport: req.body as PumpingUnitReport };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  const patchMatch = req.url.match(/\/api\/operations\/pumping\/tickets\/(\d+)\//);
  if (patchMatch && req.method === 'PATCH') {
    const id = Number(patchMatch[1]);
    const found = tickets.find(t => t.id === id);
    if (found) {
      return of(new HttpResponse({ status: 200, body: found })).pipe(delay(300));
    }
  }

  return next(req);
};
