import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { construirUbicacion, esTaladroRigless, OPCION_RIGLESS, opcionesDeCatalogo, type PozoPlataforma, type TaladroPlataforma } from '../models/catalogos-plataforma.model';
import { CatalogosPlataformaService } from './catalogos-plataforma.service';

describe('CatalogosPlataformaService', () => {
  let service: CatalogosPlataformaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogosPlataformaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('usa /api/v2/catalogos (plataforma), no /api/catalogos (demo)', () => {
    service.clientes().subscribe();
    http.expectOne('/api/v2/catalogos/clientes').flush([]);
    service.taladros().subscribe();
    http.expectOne('/api/v2/catalogos/taladros').flush([]);
    service.campos().subscribe();
    http.expectOne('/api/v2/catalogos/campos').flush([]);
    service.bloques().subscribe();
    http.expectOne('/api/v2/catalogos/bloques').flush([]);
  });

  it('trae bodegas y condiciones de pago', () => {
    service.bodegas().subscribe();
    http.expectOne('/api/v2/catalogos/bodegas').flush([]);
    service.condicionesPago().subscribe();
    http.expectOne('/api/v2/catalogos/condiciones-pago').flush([]);
  });

  it('filtra personas por tipo y pozos por campo', () => {
    service.personas('representante_quito').subscribe();
    const p = http.expectOne(r => r.url === '/api/v2/catalogos/personas');
    expect(p.request.params.get('tipo')).toBe('representante_quito');
    p.flush([]);
    service.pozos({ campoId: 'c1' }).subscribe();
    const z = http.expectOne(r => r.url === '/api/v2/catalogos/pozos');
    expect(z.request.params.get('campoId')).toBe('c1');
    z.flush([]);
  });
});

describe('opcionesDeCatalogo', () => {
  const lista = [
    { id: 'a', as2Id: 1, nombre: 'Quito', habilitado: true },
    { id: 'b', as2Id: 2, nombre: 'Coca', habilitado: false },
    { id: 'c', as2Id: 3, nombre: 'Shushufindi', habilitado: false },
  ];
  it('ofrece las habilitadas', () => {
    expect(opcionesDeCatalogo(lista, null)).toEqual([{ label: 'Quito', value: 'a' }]);
  });
  it('conserva la vigente aunque esté inhabilitada, rotulada', () => {
    expect(opcionesDeCatalogo(lista, 'b')).toEqual([
      { label: 'Quito', value: 'a' },
      { label: 'Coca (inhabilitado)', value: 'b' },
    ]);
  });
});

describe('construirUbicacion', () => {
  const pozo: PozoPlataforma = {
    id: 'p1', legacyId: null, codigo: 'AMSA-006', nombreCompleto: 'AMISTAD-A006', campoId: 'ca1', bloqueId: 'b1', habilitado: true,
    campo: { id: 'ca1', legacyId: null, nombre: 'Amistad', zonaId: null, zona: 'ZONA OESTE', habilitado: true },
    bloque: { id: 'b1', legacyId: null, nombre: 'Bloque 6', habilitado: true },
  };
  const taladro = (nombre: string): TaladroPlataforma => ({ id: 't1', legacyId: null, nombre, rigContractual: null, habilitado: true });

  it('toma campo, bloque y zona del pozo y deja el UUID del taladro', () => {
    expect(construirUbicacion(pozo, taladro('DYN-1'))).toMatchObject({ pozoId: 'p1', campoId: 'ca1', campo: 'Amistad', bloqueId: 'b1', bloque: 'Bloque 6', taladroId: 't1', rigless: false, zona: 'ZONA OESTE' });
  });

  it('RIGLESS se traduce a rigless sin taladro', () => {
    expect(esTaladroRigless(' rigless ')).toBe(true);
    expect(construirUbicacion(pozo, taladro('RIGLESS'))).toMatchObject({ taladroId: null, rigless: true, taladro: 'RIGLESS' });
  });

  it('la opción RIGLESS del select no depende del catálogo de taladros', () => {
    expect(construirUbicacion(pozo, undefined, [], true)).toMatchObject({ pozoId: 'p1', taladroId: null, rigless: true, taladro: 'RIGLESS', campo: 'Amistad', zona: 'ZONA OESTE' });
    expect(OPCION_RIGLESS).toBe('__rigless__');
  });

  it('sin pozo queda vacía', () => {
    expect(construirUbicacion(undefined, undefined)).toMatchObject({ pozoId: null, campoId: null, taladroId: null, rigless: false });
  });
});
