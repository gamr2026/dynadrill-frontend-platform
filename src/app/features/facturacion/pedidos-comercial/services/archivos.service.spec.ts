import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ArchivosService } from './archivos.service';
import { PedidosComercialService } from './pedidos-comercial.service';

describe('ArchivosService y adjuntos', () => {
  let archivos: ArchivosService;
  let pedidos: PedidosComercialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    archivos = TestBed.inject(ArchivosService);
    pedidos = TestBed.inject(PedidosComercialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sube con multipart: módulo pedido_documento y archivo', () => {
    const file = new File(['x'], 'contrato.pdf', { type: 'application/pdf' });
    archivos.subir(file).subscribe();
    const req = http.expectOne('/api/archivos');
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect(form.get('modulo')).toBe('pedido_documento');
    expect((form.get('archivo') as File).name).toBe('contrato.pdf');
    req.flush({});
  });

  it('descarga el contenido como blob (con el token, por HttpClient)', () => {
    archivos.contenido('a1').subscribe();
    const req = http.expectOne('/api/archivos/a1/contenido');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('guarda con un object URL y lo revoca después', () => {
    vi.useFakeTimers();
    const crear = vi.fn(() => 'blob:x');
    const revocar = vi.fn();
    const original = { c: URL.createObjectURL, r: URL.revokeObjectURL };
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
    try {
      archivos.guardarComo(new Blob(['x']), 'a.pdf');
      expect(crear).toHaveBeenCalled();
      vi.runAllTimers();
      expect(revocar).toHaveBeenCalledWith('blob:x');
    } finally {
      URL.createObjectURL = original.c;
      URL.revokeObjectURL = original.r;
      vi.useRealTimers();
    }
  });

  it('adjunta con POST documentos { archivoId } y quita con DELETE', () => {
    pedidos.adjuntarDocumento('p1', 'a1').subscribe();
    const a = http.expectOne('/api/comercial/pedidos/p1/documentos');
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual({ archivoId: 'a1' });
    a.flush({});

    pedidos.quitarDocumento('p1', 'd1').subscribe();
    const q = http.expectOne('/api/comercial/pedidos/p1/documentos/d1');
    expect(q.request.method).toBe('DELETE');
    q.flush({});
  });
});
