import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InventarioPlataformaService } from './inventario-plataforma.service';

describe('InventarioPlataformaService', () => {
  let service: InventarioPlataformaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InventarioPlataformaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('usa /api/operaciones/inventario (backend nuevo), no /api/articulos (demo)', () => {
    service.articulos().subscribe();
    http.expectOne('/api/operaciones/inventario/articulos').flush([]);
    service.categorias().subscribe();
    http.expectOne('/api/operaciones/inventario/categorias').flush([]);
    service.unidades().subscribe();
    http.expectOne('/api/operaciones/inventario/unidades').flush([]);
    service.bodegas().subscribe();
    http.expectOne('/api/operaciones/inventario/bodegas').flush([]);
  });

  it('arma los filtros del listado como parámetros', () => {
    service.articulos({ q: 'acido', categoriaId: 'c1', activo: true, conStock: false, quimicos: true }).subscribe();
    const r = http.expectOne(req => req.url === '/api/operaciones/inventario/articulos');
    expect(r.request.params.get('q')).toBe('acido');
    expect(r.request.params.get('categoriaId')).toBe('c1');
    expect(r.request.params.get('activo')).toBe('true');
    expect(r.request.params.get('conStock')).toBe('false');
    expect(r.request.params.get('quimicos')).toBe('true');
    r.flush([]);
  });

  it('no manda filtros que no se indicaron', () => {
    service.articulos({}).subscribe();
    const r = http.expectOne(req => req.url === '/api/operaciones/inventario/articulos');
    expect(r.request.params.keys()).toEqual([]);
    r.flush([]);
  });

  it('pide el kardex de un artículo, por bodega y con límite', () => {
    service.kardex('a1', { bodegaId: 'b1', limite: 50 }).subscribe();
    const r = http.expectOne(req => req.url === '/api/operaciones/inventario/articulos/a1/movimientos');
    expect(r.request.params.get('bodegaId')).toBe('b1');
    expect(r.request.params.get('limite')).toBe('50');
    r.flush([]);
  });

  it('registra un movimiento con el motivo (que fija tipo y origen), la bodega y la cantidad', () => {
    service.registrarMovimiento({ articuloId: 'a1', bodegaId: 'b1', motivoId: 'm1', cantidad: 2.5 }).subscribe();
    const r = http.expectOne('/api/operaciones/inventario/movimientos');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ articuloId: 'a1', bodegaId: 'b1', motivoId: 'm1', cantidad: 2.5 });
    r.flush({});
  });

  it('pide solo los motivos manuales', () => {
    service.motivos({ manual: true }).subscribe();
    const r = http.expectOne(req => req.url === '/api/operaciones/inventario/motivos');
    expect(r.request.params.get('manual')).toBe('true');
    r.flush([]);
  });

  it('crea, edita y quita partes por su id', () => {
    service.crearParte('a1', { item: '1', codigo: 'P-1', descripcion: 'Resorte' }).subscribe();
    expect(http.expectOne('/api/operaciones/inventario/articulos/a1/partes').request.method).toBe('POST');
    service.actualizarParte('p1', { item: '1', codigo: 'P-1', descripcion: 'Resorte' }).subscribe();
    expect(http.expectOne('/api/operaciones/inventario/partes/p1').request.method).toBe('PUT');
    service.eliminarParte('p1').subscribe();
    expect(http.expectOne('/api/operaciones/inventario/partes/p1').request.method).toBe('DELETE');
  });

  it('actualiza un artículo y puede quitar la subcategoría con null', () => {
    service.actualizarArticulo('a1', { subcategoriaId: null, costoUnitario: null }).subscribe();
    const r = http.expectOne('/api/operaciones/inventario/articulos/a1');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ subcategoriaId: null, costoUnitario: null });
    r.flush({});
  });

  it('busca repuestos para Mantenimiento por el texto escrito', () => {
    service.repuestosDisponibles('filtro').subscribe();
    const r = http.expectOne(req => req.url === '/api/operaciones/inventario/articulos/repuestos');
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('q')).toBe('filtro');
    r.flush([]);
  });
});
