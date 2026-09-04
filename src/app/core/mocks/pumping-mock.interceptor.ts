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
import { registrarLlegadaPumping } from './maintenance-mock.interceptor';

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
    // Link de demo con Facturación: los reportes diarios se empujan al Pedido 4304.
    pedidoCode: '4304',
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
      { id: 4, articuloId: 4, name: 'Inhibidor de Corrosión', quantityAssigned: 15, quantityUsed: 12, quantityReturned: 3, unit: 'GL', consumptionRegistered: true },
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
      { id: 2, articuloId: 2, name: 'Grasa Tubing/Casing Metal Free Thread Compound', quantityAssigned: 10, quantityUsed: 8, quantityReturned: 2, unit: 'GL', consumptionRegistered: true },
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
      { id: 9, articuloId: 9, name: 'Fluido de control con cloruro de calcio @ 8.4 ppg', quantityAssigned: 35, quantityUsed: 0, quantityReturned: 0, unit: 'bbl', consumptionRegistered: false },
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
      const report = req.body as PumpingUnitReport;
      const updated: PumpingTicket = { ...tickets[idx], unitReport: report };
      tickets = tickets.map(t => (t.id === id ? updated : t));

      // Puente a Mantenimiento — solo cuando este guardado ya representa la
      // llegada (arrivalDate lleno), no el guardado parcial de salida.
      if (report.arrivalDate) {
        registrarLlegadaPumping(id, report);
      }

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
      const { operatorIds, unitIds, chemicals: chemicalsInput, chemicalMixtureDocument } = req.body as {
        operatorIds: number[];
        unitIds: number[];
        chemicals: { articuloId: number; name: string; unit: string; cantidad: number }[];
        chemicalMixtureDocument?: string;
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

      // Build operators with their assigned units
      // Use operatorAssignments from the request body if available, otherwise pair them
      const operators = operatorIds.map((opId, i) => ({
        id: opId,
        name: operatorData[opId]?.name ?? `Operador ${opId}`,
        role: operatorData[opId]?.role ?? 'Operador',
        unitCode: unitData[unitIds[i]] ?? unitData[unitIds[0]] ?? '',
      }));

      // La salida de bodega (real, contra Inventario) ya se registró desde
      // la página al momento de guardar — acá solo se persiste el detalle
      // por químico contra este ticket, con su articuloId real.
      const chemicals = (chemicalsInput ?? []).map(c => ({
        id: c.articuloId,
        articuloId: c.articuloId,
        name: c.name,
        quantityAssigned: c.cantidad,
        quantityUsed: 0,
        quantityReturned: 0,
        unit: c.unit,
        consumptionRegistered: false,
      }));

      const unitCode = unitData[unitIds[0]] ?? '';
      const updated: PumpingTicket = {
        ...tickets[idx],
        operators,
        chemicals,
        chemicalMixtureDocument: chemicalMixtureDocument || tickets[idx].chemicalMixtureDocument,
        unitCode,
        assignedOperator: operators[0]?.name ?? '',
      };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }

    // ── chemical-consumption (cierre de químicos, Ejecución operativa) ──
    if (req.url.includes('/chemical-consumption')) {
      const { chemicalId, quantityUsed } = req.body as { chemicalId: number; quantityUsed: number };
      const chemicals = tickets[idx].chemicals.map(c => {
        if (c.id !== chemicalId) return c;
        const usado = Math.min(Math.max(quantityUsed, 0), c.quantityAssigned);
        return { ...c, quantityUsed: usado, quantityReturned: c.quantityAssigned - usado, consumptionRegistered: true };
      });
      const updated: PumpingTicket = { ...tickets[idx], chemicals };
      tickets = tickets.map(t => (t.id === id ? updated : t));
      return of(new HttpResponse({ status: 200, body: updated })).pipe(delay(300));
    }

    // ── fallback: return found ticket unchanged ──
    return of(new HttpResponse({ status: 200, body: tickets[idx] })).pipe(delay(300));
  }

  return next(req);
};
