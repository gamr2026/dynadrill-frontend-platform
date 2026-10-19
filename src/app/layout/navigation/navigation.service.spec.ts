import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService, type AuthenticatedUser } from '../../core/services/auth.service';
import { NavigationService } from './navigation.service';
import { allLinks } from './nav.model';

describe('NavigationService', () => {
  const user = signal<AuthenticatedUser | null>(null);
  const events = new Subject<NavigationEnd>();

  function setup(
    roleName: string | null,
    url = '/dashboard',
    permissions: string[] = [],
  ): NavigationService {
    user.set(
      roleName
        ? {
            id: 'u-1',
            legacyId: 1,
            name: 'Ana Torres',
            email: 'a@dynadrill.com',
            roleId: 'r-1',
            roleLegacyId: 1,
            roleName,
            roleCode: 'rol',
            permissions,
          }
        : null,
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: user.asReadonly(),
            can: (codigo: string) => user()?.permissions.includes(codigo) ?? false,
          },
        },
        { provide: Router, useValue: { events, url } },
      ],
    });
    return TestBed.inject(NavigationService);
  }

  function navigate(url: string): void {
    events.next(new NavigationEnd(1, url, url));
  }

  const keys = (service: NavigationService) => service.modules().map((m) => m.key);
  const links = (service: NavigationService, key: string) =>
    allLinks(service.modules().find((m) => m.key === key)!);

  it('Flota no aparece sin el permiso de ver unidades', () => {
    expect(keys(setup('Jefe de Mantenimiento'))).not.toContain('flota');
  });

  it('Flota aparece con el permiso de ver unidades, sin importar el rol', () => {
    const service = setup('Jefe de Mantenimiento', '/dashboard', ['flota.unidades.ver']);
    expect(keys(service)).toContain('flota');
    expect(links(service, 'flota')).toEqual(['/dashboard/flota/unidades']);
  });

  it('cada destino de Flota sale por su permiso: un conductor ve inspecciones y conductores, no unidades', () => {
    const service = setup('Conductor', '/dashboard', [
      'flota.inspecciones.ver',
      'flota.conductores.ver',
    ]);
    expect(links(service, 'flota')).toEqual([
      '/dashboard/flota/inspecciones',
      '/dashboard/flota/conductores',
    ]);
  });

  it('Gerenciamiento de viaje sale con cualquiera de sus tres permisos', () => {
    const service = setup('Supervisor Pumping', '/dashboard', ['flota.viajes.aprobar']);
    expect(links(service, 'flota')).toEqual(['/dashboard/flota/viajes']);
  });

  it('Superadmin ve todos los módulos, en el orden de Figma', () => {
    const service = setup('Superadmin', '/dashboard', ['identidad.usuarios.ver']);
    expect(keys(service)).toEqual([
      'inicio',
      'operaciones',
      'mantenimiento',
      'qhse',
      'inventario',
      'facturacion',
      'usuarios',
    ]);
    expect(links(service, 'facturacion')).toContain('/dashboard/facturacion/catalogos');
  });

  it('"Roles y permisos" se muestra por permiso, no por nombre de rol', () => {
    const conPermiso = setup('Jefe de Base', '/dashboard', ['identidad.roles.ver']);
    expect(keys(conPermiso)).toEqual(['inicio', 'operaciones', 'roles-permisos']);
    expect(links(conPermiso, 'roles-permisos')).toEqual(['/roles-permisos']);
  });

  it('"Usuarios" depende de identidad.usuarios.ver, no del nombre del rol', () => {
    expect(keys(setup('Superadmin'))).not.toContain('usuarios');
    TestBed.resetTestingModule();
    const jefe = setup('Jefe de Base', '/dashboard', ['identidad.usuarios.ver']);
    expect(keys(jefe)).toEqual(['inicio', 'operaciones', 'usuarios']);
    expect(links(jefe, 'usuarios')).toEqual(['/dashboard/usuarios']);
  });

  it('un Superadmin sin ese permiso en el token no ve "Roles y permisos"', () => {
    expect(keys(setup('Superadmin'))).not.toContain('roles-permisos');
  });

  it('Supervisor Pumping ve Pumping + Aprobaciones y Gerenciamiento de Viaje, nunca FCR', () => {
    const service = setup('Supervisor Pumping');
    expect(keys(service)).toEqual(['inicio', 'operaciones']);
    expect(links(service, 'operaciones')).toEqual([
      '/modulos/operativo/pumping',
      '/modulos/operativo/pumping/pedidos',
      '/modulos/operativo/pumping/aprobaciones',
      '/dashboard/mantenimiento/gerenciamiento-viaje',
    ]);
  });

  it('Jefe de Base solo ve Pumping, sus pedidos y Gerenciamiento de Viaje en Operaciones (sin Usuarios en la UI)', () => {
    const service = setup('Jefe de Base');
    expect(keys(service)).toEqual(['inicio', 'operaciones']);
    expect(links(service, 'operaciones')).toEqual([
      '/modulos/operativo/pumping',
      '/modulos/operativo/pumping/pedidos',
      '/dashboard/mantenimiento/gerenciamiento-viaje',
    ]);
  });

  it('"Códigos por cliente" de FCR: solo Ventas FCR y Superadmin, y activa su propia entrada (no la de FCR)', () => {
    const codigos = '/modulos/operativo/fcr/configuracion-codigos';
    const service = setup('Ingeniería de Ventas FCR', codigos);
    expect(links(service, 'operaciones')).toEqual(['/modulos/operativo/fcr', codigos]);
    expect(service.activeModule().key).toBe('operaciones');
    expect(service.isActive({ label: 'FCR', link: '/modulos/operativo/fcr' })).toBe(false);

    for (const rol of ['Superadmin', 'Supervisor', 'Bodeguero', 'Ingeniería de Ventas']) {
      TestBed.resetTestingModule();
      const conCodigos = setup(rol)
        .modules()
        .some((m) => allLinks(m).includes(codigos));
      expect([rol, conCodigos]).toEqual([rol, rol === 'Superadmin']);
    }
  });

  it('Facturación no ve Catálogos', () => {
    const service = setup('Facturación');
    expect(links(service, 'facturacion')).not.toContain('/dashboard/facturacion/catalogos');
  });

  it('un rol desconocido (o sin sesión) solo ve Inicio', () => {
    expect(keys(setup('Rol inventado'))).toEqual(['inicio']);
    TestBed.resetTestingModule();
    expect(keys(setup(null))).toEqual(['inicio']);
  });

  it('resuelve el módulo activo por el link más largo que contiene la URL', () => {
    const service = setup('Superadmin', '/modulos/operativo/pumping/42', [
      'identidad.usuarios.ver',
    ]);
    expect(service.activeModule().key).toBe('operaciones');

    navigate('/dashboard/usuarios');
    expect(service.activeModule().key).toBe('usuarios');

    navigate('/dashboard/qhse/iperc');
    expect(service.activeModule().key).toBe('qhse');

    navigate('/dashboard?tab=1');
    expect(service.activeModule().key).toBe('inicio');
  });

  it('una ruta de un módulo que el rol no tiene cae en Inicio, no en un módulo ajeno', () => {
    const service = setup('Supervisor Pumping', '/dashboard/qhse/iperc');
    expect(service.activeModule().key).toBe('inicio');
  });

  it('marca activo solo el destino más específico dentro del módulo', () => {
    const service = setup('Supervisor Pumping', '/modulos/operativo/pumping/aprobaciones');
    const [pumping, , aprobaciones] = service
      .modules()
      .find((m) => m.key === 'operaciones')!.children!;
    expect(service.isActive(aprobaciones)).toBe(true);
    expect(service.isActive(pumping)).toBe(false);
  });
});
