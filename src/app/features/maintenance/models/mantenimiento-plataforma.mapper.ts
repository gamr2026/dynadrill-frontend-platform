import type {
  MaintenanceOrderWithSubOrders,
  MaintenanceType,
  Repuesto,
  SubOrder,
  SubOrderStatus,
  UnitFinalState,
} from './maintenance-order.model';
import type { MaintenanceSourceModule, UnitReport } from './unit-report.model';
import type {
  AsignacionApi,
  AvanceEntradaApi,
  EstadoSubordenApi,
  OrdenApi,
  OrigenReporteApi,
  RepuestoApi,
  RepuestoEntradaApi,
  ReporteApi,
  SubordenApi,
  TipoSubordenApi,
} from './mantenimiento-plataforma.model';

/**
 * Traductor entre el backend nuevo (códigos estables, uuid) y los modelos que usan las pantallas de Mantenimiento (textos de la
 * demo). Funciones puras. Lo que el backend nuevo no guarda (checklists del formulario físico, horómetros, firmas) queda vacío.
 */

const TIPO: Record<TipoSubordenApi, MaintenanceType> = {
  mecanico: 'Mecánico',
  instrumental: 'Instrumental',
  operativo: 'Operativo',
};
const TIPO_API = Object.fromEntries(
  Object.entries(TIPO).map(([codigo, nombre]) => [nombre, codigo]),
) as Record<MaintenanceType, TipoSubordenApi>;

const ESTADO: Record<EstadoSubordenApi, SubOrderStatus> = {
  pendiente: 'Pendiente',
  en_diagnostico: 'En Diagnóstico',
  en_ejecucion: 'En Ejecución',
  en_revision_cierre: 'En Revisión de Cierre',
  correccion_solicitada: 'Corrección Solicitada',
  cerrado: 'Cerrado',
  derivado_a_pumping: 'Derivado a Pumping',
};

const ORIGEN: Record<OrigenReporteApi, MaintenanceSourceModule> = {
  pumping: 'Pumping',
  fcr: 'FCR',
  vehiculos: 'Vehículos',
  qhse: 'QHSE',
};

const ESTADO_FINAL: Record<string, UnitFinalState> = {
  disponible: 'Disponible',
  con_restricciones: 'Con restricciones',
};

export const tipoDeSubordenApi = (tipo: MaintenanceType): TipoSubordenApi => TIPO_API[tipo];

const texto = (v: string | null | undefined): string => v ?? '';

/** Código del reporte sin la «R»: las pantallas la agregan con `unitReportCode()`. */
const numeroDeReporte = (codigo: string): string =>
  codigo.startsWith('R') ? codigo.slice(1) : codigo;

export function reporteAUnitReport(r: ReporteApi): UnitReport {
  const n = r.novedades;
  // Un reporte de QHSE trae un solo texto de novedad: se muestra como mecánica (la falla de la unidad).
  const mecanica = n.qhse ?? n.mecanica;
  return {
    id: r.id,
    reportNo: numeroDeReporte(r.codigo),
    sourceModule: ORIGEN[r.origen],
    pozo: '',
    bloque: '',
    cliente: '',
    base: '',
    unidadId: r.unidad.id,
    unidad: r.unidad.codigo,
    originTicketId: r.ticket?.id,
    fechaSalida: '',
    fechaLlegada: texto(n.fechaLlegada),
    origen: n.origen ?? undefined,
    destino: n.destino ?? undefined,
    inspeccionChasis: [],
    inspeccionPlataforma: [],
    inspeccionInstrumentacion: [],
    problemasMecanica: texto(mecanica),
    problemasInstrumentacion: texto(n.instrumentacion),
    problemasOperaciones: texto(n.operaciones),
    interrumpioOperacion: n.operacionInterrumpida ?? false,
    detalleInterrupcion: n.detalleInterrupcion ?? undefined,
    listaParaSiguienteOperacion: n.unidadLista ?? false,
    operadorSalida: '',
    supervisorSalida: '',
    dismissed: r.estado === 'descartado',
    dismissReason: r.descarte?.motivo ?? undefined,
    createdAt: r.recibidoAt,
  };
}

/** Repuesto del backend → el de la pantalla. Los del catálogo traen el código y el nombre del artículo como etiqueta. */
export function repuestoApiARepuesto(r: RepuestoApi): Repuesto {
  if (r.articulo && r.bodega) {
    return {
      articuloId: r.articulo.id,
      bodegaId: r.bodega.id,
      numeroParte: r.articulo.codigo,
      descripcion: r.articulo.nombre,
      cantidad: r.cantidad,
      bodegasDisponibles: [{ bodegaId: r.bodega.id, bodega: r.bodega.nombre }],
    };
  }
  return {
    numeroParte: texto(r.numeroParte),
    descripcion: texto(r.descripcion),
    cantidad: r.cantidad,
  };
}

/** Repuesto de la pantalla → entrada del backend: del catálogo (artículo + bodega) o de texto (número de parte). */
export function repuestoARepuestoEntrada(r: Repuesto): RepuestoEntradaApi {
  if (r.articuloId) return { articuloId: r.articuloId, bodegaId: r.bodegaId, cantidad: r.cantidad };
  return {
    numeroParte: r.numeroParte.trim(),
    descripcion: r.descripcion.trim() || null,
    cantidad: r.cantidad,
  };
}

export function subordenASubOrder(s: SubordenApi): SubOrder {
  return {
    id: s.id,
    orderId: s.ordenId,
    code: s.codigo,
    type: TIPO[s.tipo.codigo],
    assignedUserId: s.asignada?.id,
    assignedUserName: s.asignada?.nombre,
    assignedByName: s.asignadaPor?.nombre,
    status: ESTADO[s.estado.codigo],
    diagnostico: s.diagnostico ?? undefined,
    actividadesCorrectivas: s.actividadesCorrectivas ?? undefined,
    horasTrabajo: s.horasTrabajo ?? undefined,
    repuestos: s.repuestos.map(repuestoApiARepuesto),
    correctionNote: s.notaCorreccion ?? undefined,
    trabajosAdicionales: s.trabajosAdicionales ?? undefined,
    ejecucionIniciadaEn: s.ejecucionIniciadaAt ?? undefined,
    ejecucionTerminadaEn: s.ejecucionTerminadaAt ?? undefined,
    cierreAprobadoEn: s.cierreAprobadoAt ?? undefined,
    deriveNote: s.notaDerivacion ?? undefined,
  };
}

export function ordenAMaintenanceOrder(o: OrdenApi): MaintenanceOrderWithSubOrders {
  return {
    id: o.id,
    code: o.codigo,
    unidad: o.unidad.codigo,
    unitReportId: o.reporte.id,
    origin: 'MAN-001',
    sourceModule: ORIGEN[o.reporte.origen],
    pumpingTicketId: o.ticket?.id,
    createdAt: o.creadaAt,
    returnedToOperation: !!o.retorno,
    finalUnitState: o.retorno?.estadoFinal ? ESTADO_FINAL[o.retorno.estadoFinal] : undefined,
    finalObservaciones: o.retorno?.observaciones ?? undefined,
    closedAt: o.retorno?.at,
    subOrders: o.subordenes.map(subordenASubOrder),
  };
}

/** Entrada de «guardar avance» de la pantalla de ejecución → la del backend. */
export function avanceAApi(input: {
  diagnostico?: string;
  actividadesCorrectivas?: string;
  horasTrabajo?: number;
  repuestos?: Repuesto[];
  trabajosAdicionales?: string;
}): AvanceEntradaApi {
  return {
    diagnostico: input.diagnostico ?? null,
    actividadesCorrectivas: input.actividadesCorrectivas ?? null,
    horasTrabajo: input.horasTrabajo ?? null,
    trabajosAdicionales: input.trabajosAdicionales ?? null,
    ...(input.repuestos ? { repuestos: input.repuestos.map(repuestoARepuestoEntrada) } : {}),
  };
}

/**
 * Las asignaciones que describen la orden tal como está (para reasignar un operador o derivar el Operativo sin tocar lo demás):
 * las sub-órdenes cerradas se omiten (el backend las conserva) y `cambios` sobrescribe lo de un tipo.
 */
export function asignacionesDeOrden(
  orden: MaintenanceOrderWithSubOrders,
  cambios: Partial<Record<MaintenanceType, Partial<AsignacionApi>>>,
): AsignacionApi[] {
  return orden.subOrders
    .filter((s) => s.status !== 'Cerrado')
    .map((s) => {
      const base: AsignacionApi =
        s.type === 'Operativo'
          ? {
              tipo: 'operativo',
              derivar: s.status === 'Derivado a Pumping',
              notaDerivacion: s.deriveNote ?? null,
            }
          : { tipo: tipoDeSubordenApi(s.type), usuarioId: s.assignedUserId ?? null };
      return { ...base, ...cambios[s.type] };
    });
}
