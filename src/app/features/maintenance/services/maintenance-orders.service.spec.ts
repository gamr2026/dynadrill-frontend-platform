import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { OrdenApi, SubordenApi } from '../models/mantenimiento-plataforma.model';
import { MaintenanceOrdersService } from './maintenance-orders.service';
import { UnitReportsService } from './unit-reports.service';

const BASE = '/api/operaciones/mantenimiento';

const suborden = (over: Partial<SubordenApi> = {}): SubordenApi => ({
  id: 's-1',
  codigo: 'R0001-M',
  ordenId: 'o-1',
  tipo: { codigo: 'mecanico', nombre: 'Mecánico' },
  estado: { codigo: 'pendiente', nombre: 'Pendiente' },
  asignada: { id: 'u-1', nombre: 'Mario' },
  asignadaPor: null,
  notaDerivacion: null,
  notaCorreccion: null,
  diagnostico: null,
  actividadesCorrectivas: null,
  horasTrabajo: null,
  trabajosAdicionales: null,
  ejecucionIniciadaAt: null,
  ejecucionTerminadaAt: null,
  cierreAprobadoAt: null,
  repuestos: [],
  ...over,
});

const orden = (subordenes: SubordenApi[]): OrdenApi => ({
  id: 'o-1',
  codigo: 'R0001',
  estado: 'pendiente',
  reporte: { id: 'r-1', codigo: 'R0001', origen: 'pumping' },
  unidad: { id: 'un-1', codigo: 'PUM-07', nombre: 'Unidad 7', tipo: 'servicio' },
  ticket: null,
  creadaAt: '2026-10-17T10:00:00.000Z',
  retorno: null,
  subordenes,
});

describe('Mantenimiento contra el backend nuevo', () => {
  let ordenes: MaintenanceOrdersService;
  let reportes: UnitReportsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ordenes = TestBed.inject(MaintenanceOrdersService);
    reportes = TestBed.inject(UnitReportsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista las órdenes (solo las de una cuenta si se pide) y las traduce a los modelos de la pantalla', () => {
    let resultado: unknown;
    ordenes.list({ asignadaA: 'u-1' }).subscribe(r => (resultado = r));
    const req = http.expectOne(r => r.url === `${BASE}/ordenes`);
    expect(req.request.params.get('asignadaA')).toBe('u-1');
    req.flush([orden([suborden()])]);
    expect(resultado).toMatchObject([{ id: 'o-1', unidad: 'PUM-07', subOrders: [{ type: 'Mecánico', status: 'Pendiente' }] }]);
  });

  it('clasifica mandando los tipos en códigos del backend y, para el operativo, si se deriva', () => {
    ordenes
      .classify({
        unitReportId: 'r-1',
        assignments: [
          { type: 'Mecánico', userId: 'u-1' },
          { type: 'Operativo', operativoAttended: true, operativoDeriveNote: 'Para Pumping' },
        ],
      })
      .subscribe();
    const req = http.expectOne(`${BASE}/reportes/r-1/clasificar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      asignaciones: [
        { tipo: 'mecanico', usuarioId: 'u-1' },
        { tipo: 'operativo', derivar: true, notaDerivacion: 'Para Pumping' },
      ],
    });
    req.flush(orden([]));
  });

  it('guarda el avance con los repuestos del catálogo (artículo + bodega) y los de texto', () => {
    ordenes
      .updateSubOrder('s-1', {
        diagnostico: 'Filtro saturado',
        repuestos: [
          { articuloId: 'a-1', bodegaId: 'b-1', numeroParte: 'FIL-001', descripcion: 'Filtro', cantidad: 3 },
          { numeroParte: 'XZ-900', descripcion: 'Empaque', cantidad: 1 },
        ],
      })
      .subscribe();
    const req = http.expectOne(`${BASE}/subordenes/s-1/avance`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.repuestos).toEqual([
      { articuloId: 'a-1', bodegaId: 'b-1', cantidad: 3 },
      { numeroParte: 'XZ-900', descripcion: 'Empaque', cantidad: 1 },
    ]);
    req.flush(suborden());
  });

  it('aprobar y rechazar el cierre usan su propio endpoint; el rechazo lleva la nota', () => {
    ordenes.reviewSubOrder('s-1', 'approved').subscribe();
    http.expectOne(`${BASE}/subordenes/s-1/aprobar-cierre`).flush(suborden());
    ordenes.reviewSubOrder('s-1', 'rejected', 'Falta el torque').subscribe();
    const rechazo = http.expectOne(`${BASE}/subordenes/s-1/solicitar-correccion`);
    expect(rechazo.request.body).toEqual({ nota: 'Falta el torque' });
    rechazo.flush(suborden());
    ordenes.submitSubOrderForReview('s-1').subscribe();
    http.expectOne(`${BASE}/subordenes/s-1/enviar-revision`).flush(suborden());
  });

  it('devolver la unidad manda el estado final en el código del backend', () => {
    ordenes.closeOrder('o-1', { estadoFinal: 'Con restricciones', observaciones: ' Sin bomba auxiliar ' }).subscribe();
    const req = http.expectOne(`${BASE}/ordenes/o-1/retornar`);
    expect(req.request.body).toEqual({ estadoFinal: 'con_restricciones', observaciones: 'Sin bomba auxiliar' });
    req.flush(orden([]));
  });

  it('reasignar un operador repite la clasificación de la orden cambiando solo esa sub-orden', () => {
    let nueva: unknown;
    ordenes.reassignOperator('s-1', 'u-2').subscribe(s => (nueva = s));
    http.expectOne(`${BASE}/subordenes/s-1`).flush(suborden());
    http.expectOne(`${BASE}/ordenes/o-1`).flush(orden([suborden()]));
    const req = http.expectOne(`${BASE}/ordenes/o-1/clasificacion`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ asignaciones: [{ tipo: 'mecanico', usuarioId: 'u-2' }] });
    req.flush(orden([suborden({ asignada: { id: 'u-2', nombre: 'Ivan' } })]));
    expect(nueva).toMatchObject({ id: 's-1', assignedUserId: 'u-2' });
  });

  it('los reportes recibidos se leen y se descartan en el backend nuevo', () => {
    let lista: unknown;
    reportes.list().subscribe(r => (lista = r));
    http.expectOne(r => r.url === `${BASE}/reportes`).flush([
      {
        id: 'r-1',
        codigo: 'R0001',
        origen: 'pumping',
        estado: 'por_clasificar',
        recibidoAt: '2026-10-17T10:00:00.000Z',
        unidad: { id: 'un-1', codigo: 'PUM-07', nombre: 'Unidad 7', tipo: 'servicio', categoriaPeso: null },
        ticket: null,
        novedades: { mecanica: 'Fuga' },
        descarte: null,
        ordenId: null,
      },
    ]);
    expect(lista).toMatchObject([{ id: 'r-1', reportNo: '0001', problemasMecanica: 'Fuga' }]);

    reportes.dismiss('r-1', 'Era una prueba').subscribe();
    const req = http.expectOne(`${BASE}/reportes/r-1/descartar`);
    expect(req.request.body).toEqual({ motivo: 'Era una prueba' });
    req.flush({});
  });
});
