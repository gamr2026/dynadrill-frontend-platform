import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RolesPermisosService } from './roles-permisos.service';

describe('RolesPermisosService', () => {
  let service: RolesPermisosService;
  let http: HttpTestingController;
  const roleId = '0b5e7c1e-0000-4000-8000-0000000000aa';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RolesPermisosService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista los roles con GET /api/roles', () => {
    service.listarRoles().subscribe();
    const req = http.expectOne('/api/roles');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('lista el catálogo con GET /api/permissions', () => {
    service.listarPermisos().subscribe();
    const req = http.expectOne('/api/permissions');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('pide los permisos de un rol por su UUID', () => {
    let codigos: string[] = [];
    service.permisosDeRol(roleId).subscribe(c => (codigos = c));
    const req = http.expectOne(`/api/roles/${roleId}/permisos`);
    expect(req.request.method).toBe('GET');
    req.flush(['qhse.iperc.aprobar']);
    expect(codigos).toEqual(['qhse.iperc.aprobar']);
  });

  it('guarda el conjunto completo con PUT y cuerpo { permisos }', () => {
    let otorgados: string[] = [];
    service.guardarPermisos(roleId, ['a.b.c', 'd.e.f']).subscribe(r => (otorgados = r.otorgados));
    const req = http.expectOne(`/api/roles/${roleId}/permisos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ permisos: ['a.b.c', 'd.e.f'] });
    req.flush({ roleId, permisos: ['a.b.c', 'd.e.f'], otorgados: ['d.e.f'], revocados: [] });
    expect(otorgados).toEqual(['d.e.f']);
  });

  it('pide el historial con el parámetro limite (50 por defecto)', () => {
    service.historial(roleId).subscribe();
    const req = http.expectOne(`/api/roles/${roleId}/permisos/historial?limite=50`);
    expect(req.request.method).toBe('GET');
    req.flush([]);

    service.historial(roleId, 10).subscribe();
    http.expectOne(`/api/roles/${roleId}/permisos/historial?limite=10`).flush([]);
  });
});
