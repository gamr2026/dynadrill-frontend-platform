import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { ClassifyOrderInput, ClassifyTypeAssignment, CloseOrderInput } from '../../features/maintenance/services/maintenance-orders.service';
import { CreateUnitReportInput, UnitReport } from '../../features/maintenance/models/unit-report.model';
import { MaintenanceOrderWithSubOrders, SubOrder } from '../../features/maintenance/models/maintenance-order.model';

/**
 * Solo activo mientras no exista el backend real de Mantenimiento. Mismo
 * patrón que users-mock.interceptor.ts — arrays en memoria, delay() para
 * simular red, activo solo en dev.
 *
 * unitReports arranca con datos sembrados: el Reporte de Unidad lo registra
 * el OPERADOR en su área (Pumping/FCR), no Mantenimiento — el mock simula
 * que esos registros ya existen cuando Mantenimiento abre la Bandeja, en
 * vez de depender de un botón "crear reporte" que no le pertenece a este
 * módulo (ver nota en unit-report-dialog.ts).
 */
let unitReports: UnitReport[] = [
  {
    id: 1,
    reportNo: '3104',
    sourceModule: 'Pumping' as const,
    pozo: 'Guanta 43',
    bloque: '56',
    cliente: 'Petroecuador',
    base: 'Coca',
    unidad: '4-CTV-03',
    fechaSalida: '2026-06-08T08:00:00.000Z',
    fechaLlegada: '2026-06-08T18:00:00.000Z',
    horometroSalida: 5570,
    horometroLlegada: 5618,
    odometroSalida: 460036,
    odometroLlegada: 460124,
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: 'Fuga de aceite en línea de freno, sello desgastado por uso prolongado.',
    problemasInstrumentacion: 'Display de cabina no funciona.',
    problemasOperaciones: 'Válvulas de 2" mal mantenidas, fuego no sirve.',
    interrumpioOperacion: false,
    listaParaSiguienteOperacion: true,
    operadorSalida: 'J. Flores',
    supervisorSalida: 'P. Bravo',
    operadorLlegada: 'J. Flores',
    supervisorLlegada: 'P. Bravo',
    dismissed: false,
    createdAt: '2026-06-08T18:10:00.000Z',
  },
  {
    id: 2,
    reportNo: '3105',
    sourceModule: 'FCR' as const,
    pozo: 'Sacha 12',
    bloque: '61',
    cliente: 'Petroamazonas',
    base: 'Coca',
    unidad: 'PMP-14',
    fechaSalida: '2026-06-09T07:30:00.000Z',
    fechaLlegada: '2026-06-09T15:00:00.000Z',
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: '',
    problemasInstrumentacion: '',
    problemasOperaciones: '',
    interrumpioOperacion: false,
    listaParaSiguienteOperacion: true,
    operadorSalida: 'M. Ruiz',
    supervisorSalida: 'A. Torres',
    dismissed: false,
    createdAt: '2026-06-09T15:05:00.000Z',
  },
];
let nextReportId = 3;

let orders: MaintenanceOrderWithSubOrders[] = [];
let nextOrderId = 1;
let nextSubOrderId = 1;

function typeSuffix(type: string): string {
  if (type === 'Mecánico') return 'M';
  if (type === 'Instrumental') return 'I';
  return 'O';
}

/** Arma una sub-orden nueva ya con su asignación/estado inicial resuelto — usado al clasificar y al agregar tipos nuevos al editar. */
function buildSubOrder(orderId: number, orderCode: string, assignment: ClassifyTypeAssignment, assignedByName: string): SubOrder {
  const base: SubOrder = {
    id: nextSubOrderId++,
    orderId,
    code: `${orderCode}-${typeSuffix(assignment.type)}`,
    type: assignment.type,
    status: 'Pendiente',
  };
  if (assignment.type === 'Operativo') {
    const attended = assignment.operativoAttended ?? true;
    return { ...base, status: attended ? 'Derivado a Pumping' : 'Pendiente' };
  }
  if (assignment.userId) {
    return { ...base, assignedUserId: assignment.userId, assignedUserName: assignment.userName, assignedByName };
  }
  return base;
}

/** Aplica una reasignación a una sub-orden YA existente (edición de clasificación) — nunca toca una ya Cerrada. */
function applyAssignment(sub: SubOrder, assignment: ClassifyTypeAssignment | undefined, assignedByName: string): SubOrder {
  if (sub.status === 'Cerrado' || !assignment) return sub;
  if (sub.type === 'Operativo') {
    const attended = assignment.operativoAttended ?? true;
    return { ...sub, status: attended ? 'Derivado a Pumping' : 'Pendiente' };
  }
  if (assignment.userId) {
    return { ...sub, assignedUserId: assignment.userId, assignedUserName: assignment.userName, assignedByName };
  }
  return sub;
}

function matchId(url: string, base: string): number | null {
  const match = url.match(new RegExp(`${base}/(\\d+)$`));
  return match ? Number(match[1]) : null;
}

export const maintenanceMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/unit-reports' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: unitReports })).pipe(delay(300));
  }

  if (req.url === '/api/unit-reports' && req.method === 'POST') {
    const input = req.body as CreateUnitReportInput;
    const created: UnitReport = { ...input, id: nextReportId++, dismissed: false, createdAt: new Date().toISOString() };
    unitReports = [...unitReports, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const dismissReportId = req.url.match(/\/api\/unit-reports\/(\d+)\/dismiss$/);
  if (dismissReportId && req.method === 'POST') {
    const id = Number(dismissReportId[1]);
    const { reason } = req.body as { reason: string };
    unitReports = unitReports.map(r => (r.id === id ? { ...r, dismissed: true, dismissReason: reason } : r));
    return of(new HttpResponse({ status: 200 })).pipe(delay(300));
  }

  const reportId = matchId(req.url, '/api/unit-reports');
  if (reportId !== null && req.method === 'GET') {
    const found = unitReports.find(r => r.id === reportId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (req.url === '/api/maintenance-orders' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: orders })).pipe(delay(400));
  }

  if (req.url === '/api/maintenance-orders' && req.method === 'POST') {
    const input = req.body as ClassifyOrderInput;
    const orderId = nextOrderId++;
    const code = `OT-${2000 + orderId}`;
    const subOrders: SubOrder[] = input.assignments.map(a => buildSubOrder(orderId, code, a, input.assignedByName));
    const created: MaintenanceOrderWithSubOrders = {
      id: orderId,
      code,
      unidad: input.unidad,
      unitReportId: input.unitReportId,
      origin: input.origin,
      sourceModule: input.sourceModule,
      createdAt: new Date().toISOString(),
      returnedToOperation: false,
      subOrders,
    };
    orders = [...orders, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const orderId = matchId(req.url, '/api/maintenance-orders');
  if (orderId !== null && req.method === 'GET') {
    const found = orders.find(o => o.id === orderId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  const editClassificationId = req.url.match(/\/api\/maintenance-orders\/(\d+)\/classification$/);
  if (editClassificationId && req.method === 'POST') {
    const id = Number(editClassificationId[1]);
    const { assignments, assignedByName } = req.body as { assignments: ClassifyTypeAssignment[]; assignedByName: string };
    const types = assignments.map(a => a.type);
    let updated: MaintenanceOrderWithSubOrders | undefined;
    orders = orders.map(order => {
      if (order.id !== id) return order;
      // Las Cerradas se conservan aunque el tipo se destilde — no se pierde trabajo ya aprobado.
      const kept = order.subOrders
        .filter(sub => types.includes(sub.type) || sub.status === 'Cerrado')
        .map(sub => applyAssignment(sub, assignments.find(a => a.type === sub.type), assignedByName));
      const keptTypes = new Set(kept.map(s => s.type));
      const added: SubOrder[] = assignments
        .filter(a => !keptTypes.has(a.type))
        .map(a => buildSubOrder(id, order.code, a, assignedByName));
      updated = { ...order, subOrders: [...kept, ...added] };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const closeOrderId = req.url.match(/\/api\/maintenance-orders\/(\d+)\/close$/);
  if (closeOrderId && req.method === 'POST') {
    const id = Number(closeOrderId[1]);
    const input = req.body as CloseOrderInput;
    let updated: MaintenanceOrderWithSubOrders | undefined;
    orders = orders.map(order => {
      if (order.id !== id) return order;
      updated = {
        ...order,
        returnedToOperation: true,
        finalUnitState: input.estadoFinal,
        finalObservaciones: input.observaciones,
        finalResponsable: input.responsable,
      };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const subOrderId = matchId(req.url, '/api/maintenance-suborders');
  if (subOrderId !== null && req.method === 'PUT') {
    const input = req.body as Pick<SubOrder, 'diagnostico' | 'actividadesCorrectivas'>;
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== subOrderId) return sub;
        // Editar una sub-orden ya Cerrada solo corrige el texto — no la
        // reabre a revisión. Cualquier otro estado sí pasa/vuelve a
        // "En Revisión de Cierre" (incluye la primera vez que se envía).
        updated = { ...sub, ...input, status: sub.status === 'Cerrado' ? 'Cerrado' : 'En Revisión de Cierre' };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const deriveSubOrderId = req.url.match(/\/api\/maintenance-suborders\/(\d+)\/derive$/);
  if (deriveSubOrderId && req.method === 'POST') {
    const id = Number(deriveSubOrderId[1]);
    const { note } = req.body as { note: string };
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== id) return sub;
        updated = { ...sub, status: 'Derivado a Pumping', deriveNote: note };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const reviewSubOrderId = req.url.match(/\/api\/maintenance-suborders\/(\d+)\/review$/);
  if (reviewSubOrderId && req.method === 'POST') {
    const id = Number(reviewSubOrderId[1]);
    const { decision, correctionNote } = req.body as { decision: 'approved' | 'rejected'; correctionNote?: string };
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== id) return sub;
        updated = {
          ...sub,
          status: decision === 'approved' ? 'Cerrado' : 'Corrección Solicitada',
          correctionNote: decision === 'rejected' ? correctionNote : undefined,
        };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  return next(req);
};
