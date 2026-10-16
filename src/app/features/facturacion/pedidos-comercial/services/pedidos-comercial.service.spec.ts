import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { As2PedidosService } from './as2-pedidos.service';
import { ListasPreciosComercialService } from './listas-precios-comercial.service';
import { PedidosComercialService, construirParametros } from './pedidos-comercial.service';

const ID = '0b5e7c1e-0000-4000-8000-0000000000aa';

describe('construirParametros', () => {
  it('omite vacíos y une las listas con coma', () => {
    const p = construirParametros({ q: '  ', estado: null, estados: ['a', 'b'], page: 2, vacia: [], bool: true, cero: 0 });
    expect(p.keys().sort()).toEqual(['bool', 'cero', 'estados', 'page']);
    expect(p.get('estados')).toBe('a,b');
    expect(p.get('cero')).toBe('0');
  });
});

describe('PedidosComercialService', () => {
  let service: PedidosComercialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PedidosComercialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista con filtros y paginación en GET /api/comercial/pedidos', () => {
    service.listar({ q: 'pozo', linea: 'fcr', origen: 'portal', sinAnalista: true, as2Sync: 'pendiente_de_crear_en_as2', page: 2, limit: 20 }).subscribe();
    const req = http.expectOne(r => r.url === '/api/comercial/pedidos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('pozo');
    expect(req.request.params.get('linea')).toBe('fcr');
    expect(req.request.params.get('origen')).toBe('portal');
    expect(req.request.params.get('sinAnalista')).toBe('true');
    expect(req.request.params.get('as2Sync')).toBe('pendiente_de_crear_en_as2');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ items: [], total: 0, page: 2, limit: 20 });
  });

  it('no envía sinAnalista=false ni filtros vacíos', () => {
    service.listar({ sinAnalista: false, estado: null, q: '' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/comercial/pedidos');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], total: 0, page: 1, limit: 20 });
  });

  it('trae el catálogo de servicios con GET catalogo-servicios', () => {
    service.catalogoServicios().subscribe();
    const req = http.expectOne('/api/comercial/pedidos/catalogo-servicios');
    expect(req.request.method).toBe('GET');
    req.flush({ lineas: [] });
  });

  it('trae los tipos de OT del catálogo', () => {
    service.tiposOt().subscribe();
    http.expectOne('/api/comercial/pedidos/tipos-ot').flush([]);
  });

  it('trae el catálogo de estados', () => {
    service.estados().subscribe();
    http.expectOne('/api/comercial/pedidos/estados').flush([]);
  });

  it('consulta los vínculos con AS2 por ids y no llama si no hay ids', () => {
    service.vinculosAs2([]).subscribe(v => expect(v).toEqual([]));
    http.expectNone(r => r.url.includes('vinculos-as2'));
    service.vinculosAs2([16651, 16652]).subscribe();
    const req = http.expectOne(r => r.url === '/api/comercial/pedidos/vinculos-as2');
    expect(req.request.params.get('ids')).toBe('16651,16652');
    req.flush([]);
  });

  it('valida la plantilla con POST validar-plantilla', () => {
    service.validarPlantilla(ID, [{ codigo: 'A', cantidad: 2 }]).subscribe();
    const req = http.expectOne('/api/comercial/pedidos/validar-plantilla');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ clienteId: ID, filas: [{ codigo: 'A', cantidad: 2 }] });
    req.flush({ items: [], errores: [] });
  });

  it('crea desde AS2 con el id de AS2', () => {
    service.desdeAs2(16651).subscribe();
    const req = http.expectOne('/api/comercial/pedidos/desde-as2');
    expect(req.request.body).toEqual({ as2IdPedidoCliente: 16651 });
    req.flush({});
  });

  it('crea, edita (con versión) y abre', () => {
    service.crear({ clienteId: ID, abrir: false }).subscribe();
    const crear = http.expectOne('/api/comercial/pedidos');
    expect(crear.request.method).toBe('POST');
    crear.flush({});

    service.editar(ID, { version: 3, bodegaId: 'b1' }).subscribe();
    const editar = http.expectOne(`/api/comercial/pedidos/${ID}`);
    expect(editar.request.method).toBe('PUT');
    expect(editar.request.body).toEqual({ version: 3, bodegaId: 'b1' });
    editar.flush({});

    service.abrir(ID).subscribe();
    const abrir = http.expectOne(`/api/comercial/pedidos/${ID}/abrir`);
    expect(abrir.request.method).toBe('POST');
    abrir.flush({});
  });

  it('anula y rechaza con motivo', () => {
    service.anular(ID, 'cliente canceló').subscribe();
    const a = http.expectOne(`/api/comercial/pedidos/${ID}/anular`);
    expect(a.request.body).toEqual({ motivo: 'cliente canceló' });
    a.flush({});

    service.rechazar(ID, 'falta contrato').subscribe();
    const r = http.expectOne(`/api/comercial/pedidos/${ID}/rechazar`);
    expect(r.request.body).toEqual({ motivo: 'falta contrato' });
    r.flush({});
  });

  it('transiciona sin motivo ni forzar por defecto, y con ambos cuando se piden', () => {
    service.transicionar(ID, 'prefactura_generada').subscribe();
    const t1 = http.expectOne(`/api/comercial/pedidos/${ID}/transiciones`);
    expect(t1.request.body).toEqual({ estado: 'prefactura_generada' });
    t1.flush({});

    service.transicionar(ID, 'abierto', '  corrección  ', true).subscribe();
    const t2 = http.expectOne(`/api/comercial/pedidos/${ID}/transiciones`);
    expect(t2.request.body).toEqual({ estado: 'abierto', motivo: 'corrección', forzar: true });
    t2.flush({});
  });

  it('asigna analista, vincula e importa líneas de AS2', () => {
    service.asignarAnalista(ID, 'u1').subscribe();
    const a = http.expectOne(`/api/comercial/pedidos/${ID}/asignar-analista`);
    expect(a.request.body).toEqual({ analistaId: 'u1' });
    a.flush({});

    service.vincularAs2(ID, 16651).subscribe();
    const v = http.expectOne(`/api/comercial/pedidos/${ID}/vincular-as2`);
    expect(v.request.body).toEqual({ as2IdPedidoCliente: 16651 });
    v.flush({});

    service.importarLineasAs2(ID).subscribe();
    const i = http.expectOne(`/api/comercial/pedidos/${ID}/importar-lineas-as2`);
    expect(i.request.method).toBe('POST');
    i.flush({ importados: 0, sinCoincidencia: [], pedido: {} });
  });
});

describe('ListasPreciosComercialService', () => {
  let service: ListasPreciosComercialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ListasPreciosComercialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista las listas de un cliente activas', () => {
    service.listar({ clienteId: ID, activa: true }).subscribe();
    const req = http.expectOne(r => r.url === '/api/comercial/listas-precios');
    expect(req.request.params.get('clienteId')).toBe(ID);
    expect(req.request.params.get('activa')).toBe('true');
    req.flush([]);
  });

  it('busca ítems elegibles del cliente con paginación', () => {
    service.itemsDeCliente(ID, { q: 'sand', tipo: 'Servicio', page: 3, limit: 10 }).subscribe();
    const req = http.expectOne(r => r.url === '/api/comercial/listas-precios/items');
    expect(req.request.params.get('clienteId')).toBe(ID);
    expect(req.request.params.get('q')).toBe('sand');
    expect(req.request.params.get('tipo')).toBe('Servicio');
    expect(req.request.params.get('page')).toBe('3');
    req.flush({ items: [], total: 0, page: 3, limit: 10 });
  });

  it('lee los ítems de una lista', () => {
    service.items(ID, { page: 1 }).subscribe();
    const req = http.expectOne(r => r.url === `/api/comercial/listas-precios/${ID}/items`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 0, page: 1, limit: 50 });
  });
});

describe('As2PedidosService', () => {
  let service: As2PedidosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(As2PedidosService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista con filtro de líneas y página de 10', () => {
    service.listar({ page: 2, limit: 10, lineas: 'con', estado: 'PROCESADO', q: 'pozo' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/as2/pedidos');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('lineas')).toBe('con');
    expect(req.request.params.get('estado')).toBe('PROCESADO');
    expect(req.request.params.get('q')).toBe('pozo');
    req.flush({ page: 2, limit: 10, hayMas: false, total: null, items: [] });
  });

  it('pide el resumen y el detalle con líneas', () => {
    service.resumen().subscribe();
    http.expectOne('/api/as2/pedidos/resumen').flush({ total: 0, porEstado: {} });
    service.detalle(16651).subscribe();
    http.expectOne('/api/as2/pedidos/16651').flush({});
  });
});
