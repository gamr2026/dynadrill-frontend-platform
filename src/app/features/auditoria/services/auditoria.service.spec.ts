import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FILTROS_VACIOS } from '../models/auditoria.model';
import { AuditoriaService } from './auditoria.service';

const UUID = '0197aa52-1111-7222-8333-944455556666';

describe('AuditoriaService', () => {
  let servicio: AuditoriaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AuditoriaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los catálogos para armar los filtros', () => {
    servicio.catalogos().subscribe();
    const r = http.expectOne('/api/auditoria/catalogos');
    expect(r.request.method).toBe('GET');
    r.flush({ origenes: [], tiposEvento: [], sujetoTipos: [], claves: [] });
  });

  it('busca con los filtros llenos y la paginación, sin enviar lo vacío', () => {
    servicio
      .buscar({ ...FILTROS_VACIOS, origen: 'qhse', clave: 'pedido_codigo', valor: 'PED-1' }, 3, 25)
      .subscribe();
    const r = http.expectOne((req) => req.url === '/api/auditoria/eventos');
    expect(r.request.params.keys().sort()).toEqual([
      'clave',
      'limite',
      'origen',
      'pagina',
      'valor',
    ]);
    expect(r.request.params.get('pagina')).toBe('3');
    expect(r.request.params.get('origen')).toBe('qhse');
    r.flush({ total: 0, pagina: 3, limite: 25, items: [] });
  });

  it('pide la línea de tiempo de una entidad', () => {
    servicio.lineaDeTiempo('pedido', UUID, 2, 50).subscribe();
    const r = http.expectOne((req) => req.url === '/api/auditoria/linea-de-tiempo');
    expect(r.request.params.get('sujetoTipo')).toBe('pedido');
    expect(r.request.params.get('sujetoId')).toBe(UUID);
    expect(r.request.params.get('pagina')).toBe('2');
    r.flush({ total: 0, pagina: 2, limite: 50, items: [] });
  });
});
