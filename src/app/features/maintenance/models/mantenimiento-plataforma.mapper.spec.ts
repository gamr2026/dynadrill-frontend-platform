import type { OrdenApi, ReporteApi, SubordenApi } from './mantenimiento-plataforma.model';
import {
  asignacionesDeOrden,
  avanceAApi,
  ordenAMaintenanceOrder,
  repuestoApiARepuesto,
  repuestoARepuestoEntrada,
  reporteAUnitReport,
  subordenASubOrder,
} from './mantenimiento-plataforma.mapper';

const unidad = {
  id: 'un-1',
  codigo: 'PUM-07',
  nombre: 'Unidad de bombeo 7',
  tipo: 'servicio' as const,
  categoriaPeso: null,
};

const reporte = (over: Partial<ReporteApi> = {}): ReporteApi => ({
  id: 'r-1',
  codigo: 'R0042',
  origen: 'pumping',
  estado: 'por_clasificar',
  recibidoAt: '2026-10-17T10:00:00.000Z',
  unidad,
  ticket: { id: 't-1', numero: 701 },
  novedades: {
    mecanica: 'Fuga de aceite',
    instrumentacion: null,
    operaciones: 'Demora',
    destino: 'Pozo X',
    operacionInterrumpida: true,
  },
  descarte: null,
  ordenId: null,
  ...over,
});

const suborden = (over: Partial<SubordenApi> = {}): SubordenApi => ({
  id: 's-1',
  codigo: 'R0042-M',
  ordenId: 'o-1',
  tipo: { codigo: 'mecanico', nombre: 'Mecánico' },
  estado: { codigo: 'en_revision_cierre', nombre: 'En revisión de cierre' },
  asignada: { id: 'u-1', nombre: 'Mario Mecánico' },
  asignadaPor: { id: 'u-9', nombre: 'Jorge Jefe' },
  notaDerivacion: null,
  notaCorreccion: null,
  diagnostico: 'Filtro saturado',
  actividadesCorrectivas: 'Cambio de filtro',
  horasTrabajo: 1.5,
  trabajosAdicionales: null,
  ejecucionIniciadaAt: '2026-10-17T11:00:00.000Z',
  ejecucionTerminadaAt: null,
  cierreAprobadoAt: null,
  repuestos: [],
  ...over,
});

const orden = (subordenes: SubordenApi[], over: Partial<OrdenApi> = {}): OrdenApi => ({
  id: 'o-1',
  codigo: 'R0042',
  estado: 'en_mantenimiento',
  reporte: { id: 'r-1', codigo: 'R0042', origen: 'pumping' },
  unidad: { id: 'un-1', codigo: 'PUM-07', nombre: 'Unidad de bombeo 7', tipo: 'servicio' },
  ticket: { id: 't-1', numero: 701 },
  creadaAt: '2026-10-17T10:30:00.000Z',
  retorno: null,
  subordenes,
  ...over,
});

describe('traductor de Mantenimiento (backend nuevo → pantallas)', () => {
  it('el reporte conserva el id (uuid), el código sin la «R» y las novedades por categoría', () => {
    const r = reporteAUnitReport(reporte());
    expect(r).toMatchObject({
      id: 'r-1',
      reportNo: '0042',
      sourceModule: 'Pumping',
      unidadId: 'un-1',
      unidad: 'PUM-07',
      originTicketId: 't-1',
      problemasMecanica: 'Fuga de aceite',
      problemasInstrumentacion: '',
      problemasOperaciones: 'Demora',
      interrumpioOperacion: true,
      destino: 'Pozo X',
      dismissed: false,
    });
  });

  it('un reporte descartado trae su motivo; uno de QHSE muestra su único texto como mecánica', () => {
    const d = reporteAUnitReport(
      reporte({
        estado: 'descartado',
        descarte: { at: '2026-10-17T12:00:00.000Z', por: null, motivo: 'Era una prueba' },
      }),
    );
    expect(d).toMatchObject({ dismissed: true, dismissReason: 'Era una prueba' });
    const q = reporteAUnitReport(
      reporte({ origen: 'qhse', ticket: null, novedades: { qhse: 'Frenos sin ajustar' } }),
    );
    expect(q).toMatchObject({
      sourceModule: 'QHSE',
      problemasMecanica: 'Frenos sin ajustar',
      problemasOperaciones: '',
    });
  });

  it('la sub-orden traduce tipo y estado a los textos de la pantalla y trae a quien la asignó', () => {
    expect(subordenASubOrder(suborden())).toMatchObject({
      id: 's-1',
      orderId: 'o-1',
      code: 'R0042-M',
      type: 'Mecánico',
      status: 'En Revisión de Cierre',
      assignedUserId: 'u-1',
      assignedUserName: 'Mario Mecánico',
      assignedByName: 'Jorge Jefe',
      horasTrabajo: 1.5,
    });
    expect(
      subordenASubOrder(
        suborden({
          tipo: { codigo: 'operativo', nombre: 'Operativo' },
          estado: { codigo: 'derivado_a_pumping', nombre: 'x' },
          asignada: null,
          notaDerivacion: 'Para Pumping',
        }),
      ),
    ).toMatchObject({
      type: 'Operativo',
      status: 'Derivado a Pumping',
      assignedUserId: undefined,
      deriveNote: 'Para Pumping',
    });
  });

  it('la orden marca si ya volvió a operación y con qué estado', () => {
    const abierta = ordenAMaintenanceOrder(orden([suborden()]));
    expect(abierta).toMatchObject({
      id: 'o-1',
      code: 'R0042',
      unidad: 'PUM-07',
      unitReportId: 'r-1',
      pumpingTicketId: 't-1',
      returnedToOperation: false,
    });
    const cerrada = ordenAMaintenanceOrder(
      orden([], {
        retorno: {
          at: '2026-10-18T09:00:00.000Z',
          por: 'u-9',
          estadoFinal: 'con_restricciones',
          observaciones: 'Sin la bomba auxiliar',
        },
      }),
    );
    expect(cerrada).toMatchObject({
      returnedToOperation: true,
      finalUnitState: 'Con restricciones',
      finalObservaciones: 'Sin la bomba auxiliar',
    });
  });

  it('el repuesto del catálogo se muestra con su código y nombre; el de texto, con lo que se escribió', () => {
    expect(
      repuestoApiARepuesto({
        id: 'x-1',
        cantidad: 3,
        articulo: { id: 'a-1', codigo: 'FIL-001', nombre: 'Filtro de aceite' },
        bodega: { id: 'b-1', nombre: 'Matriz' },
        numeroParte: null,
        descripcion: null,
        movimientoId: null,
      }),
    ).toMatchObject({
      articuloId: 'a-1',
      bodegaId: 'b-1',
      numeroParte: 'FIL-001',
      descripcion: 'Filtro de aceite',
      cantidad: 3,
    });
    expect(
      repuestoApiARepuesto({
        id: 'x-2',
        cantidad: 1,
        articulo: null,
        bodega: null,
        numeroParte: 'XZ-900',
        descripcion: 'Empaque',
        movimientoId: null,
      }),
    ).toEqual({ numeroParte: 'XZ-900', descripcion: 'Empaque', cantidad: 1 });
  });
});

describe('traductor de Mantenimiento (pantallas → backend nuevo)', () => {
  it('el repuesto del catálogo viaja con artículo y bodega, sin texto; el de texto, con su número de parte', () => {
    expect(
      repuestoARepuestoEntrada({
        articuloId: 'a-1',
        bodegaId: 'b-1',
        numeroParte: 'FIL-001',
        descripcion: 'Filtro',
        cantidad: 2,
      }),
    ).toEqual({
      articuloId: 'a-1',
      bodegaId: 'b-1',
      cantidad: 2,
    });
    expect(
      repuestoARepuestoEntrada({ numeroParte: ' XZ-900 ', descripcion: '  ', cantidad: 1 }),
    ).toEqual({
      numeroParte: 'XZ-900',
      descripcion: null,
      cantidad: 1,
    });
  });

  it('el avance manda null en lo que no se llenó y solo manda repuestos si vienen', () => {
    expect(avanceAApi({ diagnostico: 'x' })).toEqual({
      diagnostico: 'x',
      actividadesCorrectivas: null,
      horasTrabajo: null,
      trabajosAdicionales: null,
    });
    expect(
      avanceAApi({ repuestos: [{ numeroParte: 'A', descripcion: '', cantidad: 1 }] }).repuestos,
    ).toHaveLength(1);
  });

  it('para reasignar o derivar se repite la orden como está, sin las sub-órdenes cerradas', () => {
    const o = ordenAMaintenanceOrder(
      orden([
        suborden(),
        suborden({
          id: 's-2',
          tipo: { codigo: 'instrumental', nombre: 'Instrumental' },
          estado: { codigo: 'cerrado', nombre: 'Cerrado' },
        }),
        suborden({
          id: 's-3',
          tipo: { codigo: 'operativo', nombre: 'Operativo' },
          estado: { codigo: 'pendiente', nombre: 'Pendiente' },
          asignada: null,
        }),
      ]),
    );
    expect(asignacionesDeOrden(o, {})).toEqual([
      { tipo: 'mecanico', usuarioId: 'u-1' },
      { tipo: 'operativo', derivar: false, notaDerivacion: null },
    ]);
    expect(
      asignacionesDeOrden(o, {
        Mecánico: { usuarioId: 'u-2' },
        Operativo: { derivar: true, notaDerivacion: 'Para Pumping' },
      }),
    ).toEqual([
      { tipo: 'mecanico', usuarioId: 'u-2' },
      { tipo: 'operativo', derivar: true, notaDerivacion: 'Para Pumping' },
    ]);
  });
});
