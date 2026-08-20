import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { ClassifyOrderInput, CloseOrderInput } from '../../features/maintenance/services/maintenance-orders.service';
import { MaintenanceType } from '../../features/maintenance/models/maintenance-order.model';
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
    const subOrders: SubOrder[] = input.types.map(type => ({
      id: nextSubOrderId++,
      orderId,
      code: `${code}-${typeSuffix(type)}`,
      type,
      status: 'Pendiente',
    }));
    const created: MaintenanceOrderWithSubOrders = {
      id: orderId,
      code,
      unidad: input.unidad,
      unitReportId: input.unitReportId,
      origin: input.origin,
      createdAt: new Date().toISOString(),
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
    const { types } = req.body as { types: MaintenanceType[] };
    let updated: MaintenanceOrderWithSubOrders | undefined;
    orders = orders.map(order => {
      if (order.id !== id) return order;
      // Las Cerradas se conservan aunque el tipo se destilde — no se pierde trabajo ya aprobado.
      const kept = order.subOrders.filter(sub => types.includes(sub.type) || sub.status === 'Cerrado');
      const keptTypes = new Set(kept.map(s => s.type));
      const added: SubOrder[] = types
        .filter(type => !keptTypes.has(type))
        .map(type => ({ id: nextSubOrderId++, orderId: id, code: `${order.code}-${typeSuffix(type)}`, type, status: 'Pendiente' as const }));
      updated = { ...order, subOrders: [...kept, ...added] };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const closeOrderId = req.url.match(/\/api\/maintenance-orders\/(\d+)\/close$/);
  if (closeOrderId && req.method === 'POST') {
    // El estado final se maneja en el frontend (computeOrderStatus); acá solo
    // se registra la devolución a Operaciones.
    void (req.body as CloseOrderInput);
    return of(new HttpResponse({ status: 200 })).pipe(delay(400));
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

  const reviewSubOrderId = req.url.match(/\/api\/maintenance-suborders\/(\d+)\/review$/);
  if (reviewSubOrderId && req.method === 'POST') {
    const id = Number(reviewSubOrderId[1]);
    const { decision } = req.body as { decision: 'approved' | 'rejected' };
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== id) return sub;
        updated = { ...sub, status: decision === 'approved' ? 'Cerrado' : 'Corrección Solicitada' };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  return next(req);
};
