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
  // ── Ticket principal de demo: empieza en revision_propuesta ──
  {
    id: 1,
    code: 'PUMP-2026-00456',
    status: 'en_revision',
    wellName: 'Pozo Delta-7',
    clientName: 'Petroandina',
    estimatedDate: '2026-08-08',
    assignedSupervisor: '',
    assignedOperator: '',
    unitCode: '',
    serviceType: 'coiled_tubing',
    proposalOrigin: 'AS2',
    currentStep: 'revision_propuesta',
    operators: [],
    unitReport: null,
    chemicals: [],
    tools: [],
  },
  // ── Ticket aprobado (para pestaña "Aprobados") ──
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
      novelties: { mecanica: '', instrumentacion: '', operaciones: '' },
      unitReady: true,
      operationInterrupted: false,
      interruptionDetail: '',
      departureOperatorName: 'Carlos Vega',
      departureApprovalDate: '2026-07-20',
      arrivalOperatorName: 'Carlos Vega',
      arrivalApprovalDate: '2026-07-21',
    },
    chemicals: [
      { id: 3, name: 'Surfactante SF-3', quantityAssigned: 15, quantityUsed: 12, quantityReturned: 3, unit: 'gal' },
    ],
    tools: [
      { id: 4, name: 'Válvulas de 2"', serialCode: 'VL-2034', status: 'devuelta' },
    ],
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
      departureApprovalDate: '2026-08-01',
      arrivalOperatorName: 'Marcos Torres',
      arrivalApprovalDate: '2026-08-02',
    },
    chemicals: [
      { id: 4, name: 'Fosfato', quantityAssigned: 10, quantityUsed: 8, quantityReturned: 2, unit: 'gal' },
    ],
    tools: [],
  },
  // ── Dummy — mantiene el array con id 12 para no romper refs ──
  {
    id: 12,
    code: 'PUMP-2026-00467',
    status: 'aprobado',
    wellName: 'Pozo Sigma-4',
    clientName: 'Petroandina',
    estimatedDate: '2026-09-18',
    assignedSupervisor: 'Luis Vega',
    assignedOperator: 'Jorge Salinas',
    unitCode: 'PUM-07',
    serviceType: 'coiled_tubing',
    proposalOrigin: 'AS2',
    currentStep: 'en_revision',
    operators: [
      { id: 1, name: 'Jorge Salinas', role: 'Operador Mecánico', unitCode: 'PUM-07' },
      { id: 2, name: 'David Cevallos', role: 'Operador Instrumental', unitCode: 'PUM-07' },
    ],
    unitReport: {
      reportCode: 'RU-2026-00467',
      unitCode: 'PUM-07',
      wellName: 'Pozo Sigma-4',
      baseName: 'Coco',
      blockName: '43',
      headerCode: 'DY-PUM-07',
      clientName: 'Petroandina',
      departureDate: '2026-08-22',
      arrivalDate: '',
      fuelDeparture: 88,
      fuelArrival: null,
      hubodometro: [
        { label: 'A', salida: 8100, llegada: null },
        { label: 'B', salida: 4500, llegada: null },
        { label: 'C', salida: null, llegada: null },
        { label: 'D', salida: null, llegada: null },
      ],
      tires: defaultTires,
      origin: 'Base Coco',
      destination: 'Pozo Sigma-4',
      chassisInspection: createChassisInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: null })),
      motorInspection: createMotorInspectionItems().map(i => ({ ...i, salida: 'ok' as const, llegada: null })),
      arrivalEquipmentInspection: createArrivalEquipmentItems().map(i => ({ ...i, llegada: null })),
      instrumentationInspection: createInstrumentationItems().map(i => ({ ...i, salida: 'ok' as const, llegada: null })),
      novelties: { mecanica: '', instrumentacion: '', operaciones: '' },
      unitReady: null,
      operationInterrupted: null,
      interruptionDetail: '',
      departureOperatorName: 'Jorge Salinas',
      departureApprovalDate: '2026-09-16',
      arrivalOperatorName: '',
      arrivalApprovalDate: '',
    },
    chemicals: [
      { id: 1, name: 'Biocida QX-12', quantityAssigned: 35, quantityUsed: 0, quantityReturned: 0, unit: 'gal' },
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
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) {
      return of(new HttpResponse({ status: 404 })).pipe(delay(300));
    }

    // ── assign-supervisor ──
    if (req.url.includes('/assign-supervisor')) {
      const { supervisorId } = req.body as { supervisorId: number };
      const supervisorNames: Record<number, string> = { 1: 'Luis Vega', 2: 'Ana Ruiz', 3: 'Marcos Torres' };
      const updated: PumpingTicket = {
        ...tickets[idx],
        assignedSupervisor: supervisorNames[supervisorId] ?? '',
      };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }

    // ── assign-resources ──
    if (req.url.includes('/assign-resources')) {
      const { operatorIds, unitIds, chemicalIds } = req.body as {
        operatorIds: number[];
        unitIds: number[];
        chemicalIds: number[];
      };

      const operatorData: Record<number, { name: string; role: string }> = {
        1: { name: 'Álvarez Díaz Arturo Salomón', role: 'Operador I CTU' },
        2: { name: 'Auquilla Salcán Luis Hernán', role: 'Operador de Fluidos' },
        3: { name: 'Benítez Intriago Danny Orlando', role: 'Operador II Fishing' },
        4: { name: 'Bravo Rosas Omar Alfredo', role: 'Operador II CTU' },
      };

      const unitData: Record<number, string> = {
        1: 'PUM-07', 2: 'PUM-15', 3: '4-CTV-03', 4: 'CAM-04', 5: 'CAM-08',
      };

      const chemicalData: Record<number, { name: string; unit: string }> = {
        1: { name: 'Biocida QX-12', unit: 'gal' },
        2: { name: 'Inhibidor de corrosión', unit: 'gal' },
        3: { name: 'Surfactante SF-3', unit: 'gal' },
        4: { name: 'Fosfato', unit: 'gal' },
        5: { name: 'Amonio', unit: 'gal' },
      };

      // Build operators with their assigned units
      // Use operatorAssignments from the request body if available, otherwise pair them
      const operators = operatorIds.map((opId, i) => ({
        id: opId,
        name: operatorData[opId]?.name ?? `Operador ${opId}`,
        role: operatorData[opId]?.role ?? 'Operador',
        unitCode: unitData[unitIds[i]] ?? unitData[unitIds[0]] ?? '',
      }));

      const chemicals = chemicalIds.map(cId => ({
        id: cId,
        name: chemicalData[cId]?.name ?? `Químico ${cId}`,
        quantityAssigned: 20,
        quantityUsed: 0,
        quantityReturned: 0,
        unit: chemicalData[cId]?.unit ?? 'gal',
      }));

      const unitCode = unitData[unitIds[0]] ?? '';
      const updated: PumpingTicket = {
        ...tickets[idx],
        operators,
        chemicals,
        unitCode,
        assignedOperator: operators[0]?.name ?? '',
      };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }

    // ── fallback: return found ticket unchanged ──
    return of(new HttpResponse({ status: 200, body: tickets[idx] })).pipe(delay(300));
  }

  return next(req);
};
