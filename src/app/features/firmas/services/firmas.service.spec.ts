import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FirmasService } from './firmas.service';

const UUID = '0197aa52-1111-7222-8333-944455556666';

describe('FirmasService', () => {
  let servicio: FirmasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(FirmasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide las firmas de un documento por su tipo y su id', () => {
    servicio.deDocumento('qhse_ptw', UUID).subscribe();
    const r = http.expectOne((req) => req.url === '/api/firmas');
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('documentoTipo')).toBe('qhse_ptw');
    expect(r.request.params.get('documentoId')).toBe(UUID);
    r.flush({ documentoTipo: 'qhse_ptw', documentoId: UUID, firmas: [] });
  });

  it('verifica una firma con un POST sin cuerpo propio', () => {
    servicio.verificar(UUID).subscribe();
    const r = http.expectOne(`/api/firmas/${UUID}/verificar`);
    expect(r.request.method).toBe('POST');
    r.flush({});
  });
});
