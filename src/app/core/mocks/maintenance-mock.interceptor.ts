import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { ClassifyOrderInput, ClassifyTypeAssignment, CloseOrderInput } from '../../features/maintenance/services/maintenance-orders.service';
import { CreateUnitReportInput, UnitReport } from '../../features/maintenance/models/unit-report.model';
import { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../../features/maintenance/models/maintenance-order.model';
import { Unidad } from '../../features/maintenance/models/unidad.model';
import { RegistroMantenimiento } from '../../features/maintenance/models/historial-mantenimiento.model';
import { CreateVehicleInspectionInput, VehicleInspection } from '../../features/maintenance/models/vehicle-inspection.model';

const unidades: Unidad[] = [
  {
    id: 1, code: 'PUM-07', nombre: 'Unidad de Bombeo PUM-07', tipo: 'Servicio',
    horometroActual: 1480,
    registrosPrev: [
      { tipoServicio: 'A', ultimoEnHoras: 1250, ultimaFecha: '2026-05-10' },
      { tipoServicio: 'B', ultimoEnHoras: 0,    ultimaFecha: '2025-01-15' },
    ],
    fechaUltimoMantenimiento: '2026-05-10',
  },
  {
    id: 2, code: 'PUM-15', nombre: 'Unidad de Bombeo PUM-15', tipo: 'Servicio',
    horometroActual: 3950,
    registrosPrev: [
      { tipoServicio: 'A', ultimoEnHoras: 3750, ultimaFecha: '2026-07-20' },
      { tipoServicio: 'B', ultimoEnHoras: 2000, ultimaFecha: '2025-08-01' },
    ],
    fechaUltimoMantenimiento: '2026-07-20',
  },
  {
    id: 3, code: '4-CTV-03', nombre: 'Unidad CTU 4-CTV-03', tipo: 'Servicio',
    horometroActual: 5620,
    registrosPrev: [
      { tipoServicio: 'A', ultimoEnHoras: 5500, ultimaFecha: '2026-08-01' },
      { tipoServicio: 'B', ultimoEnHoras: 4000, ultimaFecha: '2025-11-10' },
    ],
    fechaUltimoMantenimiento: '2026-08-01',
  },
  {
    id: 4, code: 'GEN-01', nombre: 'Generador auxiliar GEN-01', tipo: 'Auxiliar',
    fechaUltimoMantenimientoAux: '2026-03-15',
  },
  {
    id: 5, code: 'GEN-02', nombre: 'Generador auxiliar GEN-02', tipo: 'Auxiliar',
    fechaUltimoMantenimientoAux: '2025-12-01',
  },
  {
    id: 6, code: 'CAM-04', nombre: 'Camioneta CAM-04', tipo: 'Transporte',
    kmActual: 87400,
    kmUltimoMantenimiento: 85000,
    fechaUltimoMantenimientoKm: '2026-07-10',
  },
  {
    id: 7, code: 'CAM-08', nombre: 'Camión CAM-08', tipo: 'Transporte',
    kmActual: 142800,
    kmUltimoMantenimiento: 138000,
    fechaUltimoMantenimientoKm: '2026-06-20',
  },
  {
    id: 8, code: 'PMP-14', nombre: 'Unidad de Bombeo PMP-14', tipo: 'Servicio',
    horometroActual: 2210,
    registrosPrev: [
      { tipoServicio: 'A', ultimoEnHoras: 2100, ultimaFecha: '2026-06-25' },
      { tipoServicio: 'B', ultimoEnHoras: 2000, ultimaFecha: '2026-05-12' },
    ],
    fechaUltimoMantenimiento: '2026-06-25',
  },
  {
    // Cisterna sin horómetro — cubre la regla de 180 días sin depender de horas (correo del cliente).
    id: 9, code: 'CIS-02', nombre: 'Cisterna CIS-02', tipo: 'Servicio',
    fechaUltimoMantenimiento: '2026-01-20',
  },
];

/**
 * Historial persistente de mantenimientos ejecutados (MAN-003) — a
 * diferencia de `registrosPrev` en Unidad (que solo guarda el último
 * registro por tipo), acá se conserva cada intervención. Se alimenta
 * desde el registro de PM y desde el cierre de una orden correctiva.
 */
let historial: RegistroMantenimiento[] = [
  {
    id: 1, unidadId: 1, unidadCode: 'PUM-07', clase: 'Preventivo', tipoServicio: 'A',
    fecha: '2026-05-10', horometro: 1250, responsable: 'C. Vega', ejecutadoPor: 'Interno', checklistRealizado: true,
  },
  {
    id: 2, unidadId: 3, unidadCode: '4-CTV-03', clase: 'Preventivo', tipoServicio: 'A',
    fecha: '2026-08-01', horometro: 5500, responsable: 'C. Vega', ejecutadoPor: 'Interno', checklistRealizado: true,
  },
  {
    id: 3, unidadId: 6, unidadCode: 'CAM-04', clase: 'Preventivo',
    fecha: '2026-07-10', km: 85000, responsable: 'Taller Norte', ejecutadoPor: 'Tercero', proveedor: 'Lubricentro Norte S.A.',
  },
];
let nextHistorialId = 4;

let vehicleInspections: VehicleInspection[] = [];
let nextInspectionId = 1;

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
    unidadId: 3,
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
    unidadId: 8,
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
  {
    id: 3,
    reportNo: '3110',
    sourceModule: 'Pumping' as const,
    pozo: 'Libertador 18',
    bloque: '57',
    cliente: 'Repsol',
    base: 'Lago Agrio',
    unidadId: 1,
    unidad: 'PUM-07',
    fechaSalida: '2026-07-14T06:00:00.000Z',
    fechaLlegada: '2026-07-14T20:00:00.000Z',
    horometroSalida: 1420,
    horometroLlegada: 1480,
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: 'Ruido inusual en transmisión al cambiar de marcha.',
    problemasInstrumentacion: 'Sensor de presión de fluido mostrando lecturas inconsistentes.',
    problemasOperaciones: '',
    interrumpioOperacion: true,
    detalleInterrupcion: 'Se detuvo operación 2h por revisión de transmisión.',
    listaParaSiguienteOperacion: false,
    operadorSalida: 'R. Cabrera',
    supervisorSalida: 'F. Morales',
    operadorLlegada: 'R. Cabrera',
    supervisorLlegada: 'F. Morales',
    dismissed: false,
    createdAt: '2026-07-14T20:30:00.000Z',
  },
  {
    id: 4,
    reportNo: '3118',
    sourceModule: 'FCR' as const,
    pozo: 'Shushufindi 32',
    bloque: '53',
    cliente: 'OCP',
    base: 'Shushufindi',
    unidadId: 3,
    unidad: '4-CTV-03',
    fechaSalida: '2026-07-28T05:30:00.000Z',
    fechaLlegada: '2026-07-28T19:00:00.000Z',
    horometroSalida: 5618,
    horometroLlegada: 5670,
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: 'Correa del alternador con desgaste visible, requiere reemplazo preventivo.',
    problemasInstrumentacion: '',
    problemasOperaciones: 'Válvula de baja presión con fuga leve detectada al final del turno.',
    interrumpioOperacion: false,
    listaParaSiguienteOperacion: true,
    operadorSalida: 'L. Andrade',
    supervisorSalida: 'P. Bravo',
    operadorLlegada: 'L. Andrade',
    supervisorLlegada: 'P. Bravo',
    dismissed: false,
    createdAt: '2026-07-28T19:15:00.000Z',
  },
  {
    id: 5,
    reportNo: '3125',
    sourceModule: 'Pumping' as const,
    pozo: 'Auca 14',
    bloque: '61',
    cliente: 'Petroecuador',
    base: 'Coca',
    unidadId: 2,
    unidad: 'PUM-15',
    fechaSalida: '2026-08-05T07:00:00.000Z',
    fechaLlegada: '2026-08-05T18:00:00.000Z',
    horometroSalida: 3890,
    horometroLlegada: 3950,
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: '',
    problemasInstrumentacion: 'Panel de instrumentación — indicador de temperatura no responde.',
    problemasOperaciones: '',
    interrumpioOperacion: false,
    listaParaSiguienteOperacion: true,
    operadorSalida: 'C. Herrera',
    supervisorSalida: 'A. Torres',
    operadorLlegada: 'C. Herrera',
    supervisorLlegada: 'A. Torres',
    dismissed: false,
    createdAt: '2026-08-05T18:20:00.000Z',
  },
];
let nextReportId = 6;

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
  if (req.url === '/api/unidades' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: unidades.map(u => ({ ...u })) })).pipe(delay(300));
  }

  const unidadMantenimientoMatch = req.url.match(/\/api\/unidades\/(\d+)\/mantenimiento$/);
  if (unidadMantenimientoMatch && req.method === 'PATCH') {
    const unidadId = Number(unidadMantenimientoMatch[1]);
    const body = req.body as {
      tipoServicio?: 'A' | 'B';
      horometroAlMomento?: number;
      kmAlMomento?: number;
      fecha: string;
      responsable: string;
      observaciones?: string;
      checklistRealizado?: boolean;
      ejecutadoPor: 'Interno' | 'Tercero';
      proveedor?: string;
    };
    const idx = unidades.findIndex(u => u.id === unidadId);
    if (idx !== -1) {
      const u = { ...unidades[idx] };
      if (body.ejecutadoPor === 'Tercero' && body.proveedor) {
        u.proveedorMantenimiento = body.proveedor;
      }
      if (u.tipo === 'Servicio' && body.tipoServicio && body.horometroAlMomento !== undefined) {
        let regs = (u.registrosPrev ?? []).map(r =>
          r.tipoServicio === body.tipoServicio
            ? { ...r, ultimoEnHoras: body.horometroAlMomento!, ultimaFecha: body.fecha }
            : r
        );
        if (!regs.some(r => r.tipoServicio === body.tipoServicio)) {
          regs.push({ tipoServicio: body.tipoServicio, ultimoEnHoras: body.horometroAlMomento!, ultimaFecha: body.fecha });
        }
        // Cascada: un servicio B incluye las actividades de A, así que también resetea su contador.
        if (body.tipoServicio === 'B') {
          regs = regs.map(r =>
            r.tipoServicio === 'A' ? { ...r, ultimoEnHoras: body.horometroAlMomento!, ultimaFecha: body.fecha } : r
          );
          if (!regs.some(r => r.tipoServicio === 'A')) {
            regs.push({ tipoServicio: 'A', ultimoEnHoras: body.horometroAlMomento!, ultimaFecha: body.fecha });
          }
        }
        u.registrosPrev = regs;
        u.fechaUltimoMantenimiento = body.fecha;
      } else if (u.tipo === 'Auxiliar') {
        u.fechaUltimoMantenimientoAux = body.fecha;
      } else if (u.tipo === 'Transporte' && body.kmAlMomento !== undefined) {
        u.kmUltimoMantenimiento = body.kmAlMomento;
        u.kmActual = body.kmAlMomento;
        u.fechaUltimoMantenimientoKm = body.fecha;
      } else if (u.tipo === 'Servicio' && !body.tipoServicio) {
        // regla de 6 meses (sin tipoServicio — la unidad no tiene horómetro)
        u.fechaUltimoMantenimiento = body.fecha;
      }
      unidades[idx] = u;

      historial = [...historial, {
        id: nextHistorialId++,
        unidadId: u.id,
        unidadCode: u.code,
        clase: 'Preventivo',
        tipoServicio: body.tipoServicio,
        fecha: body.fecha,
        horometro: body.horometroAlMomento,
        km: body.kmAlMomento,
        responsable: body.responsable,
        ejecutadoPor: body.ejecutadoPor,
        proveedor: body.proveedor,
        observaciones: body.observaciones,
        checklistRealizado: body.checklistRealizado,
      }];

      return of(new HttpResponse({ status: 200, body: unidades[idx] })).pipe(delay(400));
    }
    return of(new HttpResponse({ status: 404 })).pipe(delay(300));
  }

  if (req.url.startsWith('/api/historial-mantenimiento') && req.method === 'GET') {
    const params = new URLSearchParams(req.url.split('?')[1] ?? '');
    const unidadIdParam = params.get('unidadId');
    const filtered = unidadIdParam ? historial.filter(h => h.unidadId === Number(unidadIdParam)) : historial;
    return of(new HttpResponse({ status: 200, body: [...filtered].sort((a, b) => b.fecha.localeCompare(a.fecha)) })).pipe(delay(300));
  }

  if (req.url === '/api/vehicle-inspections' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: [...vehicleInspections].sort((a, b) => b.fecha.localeCompare(a.fecha)) })).pipe(delay(300));
  }

  if (req.url === '/api/vehicle-inspections' && req.method === 'POST') {
    const input = req.body as CreateVehicleInspectionInput;
    const created: VehicleInspection = { ...input, id: nextInspectionId++, createdAt: new Date().toISOString() };
    vehicleInspections = [...vehicleInspections, created];

    // Puente MAN-002: el kilometraje de la inspección alimenta Unidad.kmActual.
    const unidadIdx = unidades.findIndex(u => u.id === input.unidadId);
    if (unidadIdx !== -1 && input.kmFinal) {
      const u = { ...unidades[unidadIdx] };
      u.kmActual = Math.max(u.kmActual ?? 0, input.kmFinal);
      unidades[unidadIdx] = u;
    }

    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  if (req.url === '/api/unit-reports' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: unitReports })).pipe(delay(300));
  }

  if (req.url === '/api/unit-reports' && req.method === 'POST') {
    const input = req.body as CreateUnitReportInput;
    const created: UnitReport = { ...input, id: nextReportId++, dismissed: false, createdAt: new Date().toISOString() };
    unitReports = [...unitReports, created];

    // Enlaza de vuelta con la Inspección de Vehículos que originó este
    // reporte, para poder rastrear si la novedad ya se atendió.
    if (input.originVehicleInspectionId !== undefined) {
      vehicleInspections = vehicleInspections.map(vi =>
        vi.id === input.originVehicleInspectionId ? { ...vi, unitReportId: created.id } : vi,
      );
    }

    // MAN-002: el Reporte de Unidad alimenta el horómetro/km de la unidad —
    // toma siempre el máximo para que un reporte cargado tarde no haga
    // retroceder el contador.
    const unidadIdx = unidades.findIndex(u => u.id === input.unidadId);
    if (unidadIdx !== -1) {
      const u = { ...unidades[unidadIdx] };
      if (u.tipo === 'Servicio' && input.horometroLlegada !== undefined) {
        u.horometroActual = Math.max(u.horometroActual ?? 0, input.horometroLlegada);
      }
      if (u.tipo === 'Transporte' && input.odometroLlegada !== undefined) {
        u.kmActual = Math.max(u.kmActual ?? 0, input.odometroLlegada);
      }
      unidades[unidadIdx] = u;
    }

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
    // El correo del cliente pide mantener el mismo número del Reporte de
    // Unidad para dar seguimiento — la orden no lleva correlativo propio.
    const reportNo = unitReports.find(r => r.id === input.unitReportId)?.reportNo;
    const code = reportNo ? `OT-${reportNo}` : `OT-${2000 + orderId}`;
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
        closedAt: new Date().toISOString(),
      };
      return updated;
    });

    if (updated) {
      const unidad = unidades.find(u => u.code === updated!.unidad);
      if (unidad) {
        historial = [...historial, {
          id: nextHistorialId++,
          unidadId: unidad.id,
          unidadCode: unidad.code,
          clase: 'Correctivo',
          fecha: new Date().toISOString().slice(0, 10),
          responsable: input.responsable,
          ejecutadoPor: 'Interno',
          observaciones: input.observaciones,
          ordenId: updated.id,
        }];
      }
    }

    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const subOrderId = matchId(req.url, '/api/maintenance-suborders');
  if (subOrderId !== null && req.method === 'PUT') {
    const input = req.body as Pick<SubOrder, 'diagnostico' | 'actividadesCorrectivas' | 'horasTrabajo' | 'repuestos' | 'trabajosAdicionales'>;
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== subOrderId) return sub;
        // Guardar avance: pasa a En Ejecución (salvo si ya está en un estado posterior).
        const keepStatus: SubOrderStatus[] = ['En Revisión de Cierre', 'Cerrado', 'Corrección Solicitada'];
        const nextStatus: SubOrderStatus = keepStatus.includes(sub.status) ? sub.status : 'En Ejecución';
        const ejecucionIniciadaEn = sub.ejecucionIniciadaEn ?? (nextStatus === 'En Ejecución' ? new Date().toISOString() : undefined);
        updated = { ...sub, ...input, status: nextStatus, ejecucionIniciadaEn };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const submitSubOrderId = req.url.match(/\/api\/maintenance-suborders\/(\d+)\/submit$/);
  if (submitSubOrderId && req.method === 'POST') {
    const id = Number(submitSubOrderId[1]);
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== id) return sub;
        updated = {
          ...sub,
          status: sub.status === 'Cerrado' ? 'Cerrado' : 'En Revisión de Cierre',
          ejecucionTerminadaEn: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  const reassignOperatorId = req.url.match(/\/api\/maintenance-suborders\/(\d+)\/operator$/);
  if (reassignOperatorId && req.method === 'PATCH') {
    const id = Number(reassignOperatorId[1]);
    const { userId, userName, assignedByName } = req.body as { userId: number; userName: string; assignedByName: string };
    let updated: SubOrder | undefined;
    orders = orders.map(order => ({
      ...order,
      subOrders: order.subOrders.map(sub => {
        if (sub.id !== id) return sub;
        updated = { ...sub, assignedUserId: userId, assignedUserName: userName, assignedByName };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(300));
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
          cierreAprobadoEn: decision === 'approved' ? new Date().toISOString() : sub.cierreAprobadoEn,
        };
        return updated;
      }),
    }));
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  return next(req);
};
