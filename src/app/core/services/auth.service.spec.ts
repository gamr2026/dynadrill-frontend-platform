import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService, type AuthenticatedUser } from './auth.service';

const usuario = (over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: '0b5e7c1e-0000-4000-8000-000000000001',
  legacyId: 7,
  name: 'Ana Torres',
  email: 'ana@dynadrill.com',
  roleId: '0b5e7c1e-0000-4000-8000-0000000000aa',
  roleLegacyId: 4,
  roleName: 'Jefe de Base',
  roleCode: 'jefe_base',
  permissions: ['comercial.pedidos.crear'],
  ...over,
});

const respuesta = (over: Partial<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }> = {}) => ({
  accessToken: 'acc-1',
  refreshToken: 'ref-1',
  expiresIn: 900,
  user: usuario(),
  ...over,
});

describe('AuthService', () => {
  let http: HttpTestingController;

  function crear(): AuthService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  /** Abre sesión por el flujo real (login) para que el servicio quede con token, refresh token y usuario. */
  function iniciarSesion(auth: AuthService, over: Parameters<typeof respuesta>[0] = {}): void {
    auth.login('ana@dynadrill.com', 'clave-segura').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(over));
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => http.verify());

  describe('login', () => {
    it('guarda access token, refresh token, expiración y usuario con id string', () => {
      const auth = crear();
      const antes = Date.now();
      iniciarSesion(auth);

      expect(auth.getToken()).toBe('acc-1');
      expect(auth.getRefreshToken()).toBe('ref-1');
      expect(localStorage.getItem('dynadrill_refresh_token')).toBe('ref-1');
      expect(auth.accessTokenExpiresAt()!).toBeGreaterThanOrEqual(antes + 900_000);
      expect(auth.currentUser()?.id).toBe('0b5e7c1e-0000-4000-8000-000000000001');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('marca la sesión como Superadmin real por roleCode y guarda su id (string)', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ roleCode: 'superadmin', roleName: 'Superadmin' }) });

      expect(auth.puedeActuarComo()).toBe(true);
      expect(auth.superadminId()).toBe('0b5e7c1e-0000-4000-8000-000000000001');
    });
  });

  describe('sesión guardada', () => {
    it('restaura una sesión válida', () => {
      localStorage.setItem('dynadrill_access_token', 'acc-x');
      localStorage.setItem('dynadrill_refresh_token', 'ref-x');
      localStorage.setItem('dynadrill_current_user', JSON.stringify(usuario()));
      const auth = crear();

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getRefreshToken()).toBe('ref-x');
    });

    it('descarta una sesión del backend anterior (id numérico) en vez de arrancar a medias', () => {
      localStorage.setItem('dynadrill_access_token', 'acc-viejo');
      localStorage.setItem(
        'dynadrill_current_user',
        JSON.stringify({ id: 3, name: 'Viejo', email: 'v@d.com', roleId: 1, roleName: 'Operador' }),
      );
      const auth = crear();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.currentUser()).toBeNull();
      expect(localStorage.getItem('dynadrill_access_token')).toBeNull();
    });

    it('tolera un usuario corrupto en localStorage', () => {
      localStorage.setItem('dynadrill_access_token', 'acc-x');
      localStorage.setItem('dynadrill_current_user', '{no-es-json');
      const auth = crear();

      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('permisos', () => {
    it('can y canAny responden según los permisos del usuario', () => {
      const auth = crear();
      expect(auth.can('qhse.iperc.aprobar')).toBe(false);
      iniciarSesion(auth, { user: usuario({ permissions: ['qhse.iperc.aprobar', 'comercial.pedidos.crear'] }) });

      expect(auth.permissions()).toEqual(['qhse.iperc.aprobar', 'comercial.pedidos.crear']);
      expect(auth.can('qhse.iperc.aprobar')).toBe(true);
      expect(auth.can('identidad.roles.ver')).toBe(false);
      expect(auth.canAny('identidad.roles.ver', 'comercial.pedidos.crear')).toBe(true);
      expect(auth.canAny('identidad.roles.ver', 'otro.x.y')).toBe(false);
      expect(auth.canAny()).toBe(false);
    });

    it('rehidrata los permisos junto con el usuario guardado', () => {
      localStorage.setItem('dynadrill_access_token', 'acc-x');
      localStorage.setItem('dynadrill_current_user', JSON.stringify(usuario({ permissions: ['identidad.roles.ver'] })));
      const auth = crear();

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.can('identidad.roles.ver')).toBe(true);
    });

    it('una sesión guardada sin permisos arranca sin permisos, sin romper el arranque', () => {
      const { permissions: _omitido, ...sinPermisos } = usuario();
      localStorage.setItem('dynadrill_access_token', 'acc-x');
      localStorage.setItem('dynadrill_current_user', JSON.stringify(sinPermisos));
      const auth = crear();

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.permissions()).toEqual([]);
      expect(auth.can('comercial.pedidos.crear')).toBe(false);
    });

    it('persiste los permisos al iniciar sesión y los actualiza tras refresh y switchRole', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ permissions: ['a.b.c'] }) });
      expect(JSON.parse(localStorage.getItem('dynadrill_current_user')!).permissions).toEqual(['a.b.c']);

      auth.refresh().subscribe();
      http.expectOne('/api/auth/refresh').flush(respuesta({ user: usuario({ permissions: ['a.b.c', 'd.e.f'] }) }));
      expect(auth.can('d.e.f')).toBe(true);

      auth.switchRole('Operador', 'operador');
      http.expectOne('/api/auth/switch-role').flush({
        accessToken: 'acc-imp',
        expiresIn: 300,
        user: usuario({ roleCode: 'operador', permissions: ['x.y.z'] }),
      });
      expect(auth.can('x.y.z')).toBe(true);
      expect(auth.can('a.b.c')).toBe(false);
    });

    it('si el backend no envía permissions en la respuesta, el usuario queda sin permisos', () => {
      const auth = crear();
      const { permissions: _omitido, ...sinPermisos } = usuario();
      iniciarSesion(auth, { user: sinPermisos as AuthenticatedUser });

      expect(auth.permissions()).toEqual([]);
    });
  });

  describe('legacyUserId', () => {
    it('expone el legacyId del usuario de la sesión', () => {
      const auth = crear();
      expect(auth.legacyUserId()).toBeNull();
      iniciarSesion(auth);
      expect(auth.legacyUserId()).toBe(7);
    });

    it('es null si el usuario no existe en la demo', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ legacyId: null }) });
      expect(auth.legacyUserId()).toBeNull();
    });

    it('al actuar como una persona concreta toma el legacyId de esa persona, y al volver a Superadmin recupera el propio', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ roleCode: 'superadmin', roleName: 'Superadmin', legacyId: 1 }) });

      auth.switchRole('Operador de Mantenimiento', 'operador_mantenimiento', { legacyId: 42 });
      http.expectOne('/api/auth/switch-role').flush({
        accessToken: 'acc-imp',
        expiresIn: 300,
        user: usuario({ roleCode: 'operador_mantenimiento', legacyId: 1 }),
      });
      expect(auth.legacyUserId()).toBe(42);

      auth.switchRole('Superadmin', 'superadmin');
      http.expectOne('/api/auth/switch-role').flush({
        accessToken: 'acc-sa',
        expiresIn: 300,
        user: usuario({ roleCode: 'superadmin', legacyId: 1 }),
      });
      expect(auth.legacyUserId()).toBe(1);
    });
  });

  describe('switchRole', () => {
    it('pide el rol por roleCode y NO reemplaza el refresh token guardado', () => {
      const auth = crear();
      iniciarSesion(auth);

      auth.switchRole('Operador', 'operador');
      const req = http.expectOne('/api/auth/switch-role');
      expect(req.request.body).toEqual({ roleCode: 'operador' });
      req.flush({ accessToken: 'acc-imp', expiresIn: 300, user: usuario({ roleCode: 'operador', roleName: 'Operador' }) });

      expect(auth.getToken()).toBe('acc-imp');
      expect(auth.getRefreshToken()).toBe('ref-1');
      expect(auth.currentUser()?.roleCode).toBe('operador');
    });

    it('si el backend lo rechaza cae al cambio solo-cliente', () => {
      const auth = crear();
      iniciarSesion(auth);

      auth.switchRole('Operador', 'operador');
      http.expectOne('/api/auth/switch-role').flush({ message: 'No permitido' }, { status: 403, statusText: 'Forbidden' });

      expect(auth.getToken()).toBe('acc-1');
      expect(auth.currentUser()?.roleName).toBe('Operador');
      expect(auth.currentUser()?.roleCode).toBe('operador');
    });
  });

  describe('refresh', () => {
    it('cambia el refresh token y guarda el nuevo', () => {
      const auth = crear();
      iniciarSesion(auth);

      auth.refresh().subscribe();
      const req = http.expectOne('/api/auth/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'ref-1' });
      req.flush(respuesta({ accessToken: 'acc-2', refreshToken: 'ref-2' }));

      expect(auth.getToken()).toBe('acc-2');
      expect(auth.getRefreshToken()).toBe('ref-2');
      expect(localStorage.getItem('dynadrill_refresh_token')).toBe('ref-2');
    });

    it('es single-flight: varias peticiones simultáneas comparten una sola renovación', () => {
      const auth = crear();
      iniciarSesion(auth);

      const resultados: string[] = [];
      for (let i = 0; i < 3; i++) auth.refresh().subscribe(r => resultados.push(r.accessToken));
      http.expectOne('/api/auth/refresh').flush(respuesta({ accessToken: 'acc-2', refreshToken: 'ref-2' }));

      expect(resultados).toEqual(['acc-2', 'acc-2', 'acc-2']);
      // Terminada la renovación, una nueva solicitud vuelve a ir al backend (con el refresh token nuevo).
      auth.refresh().subscribe();
      expect(http.expectOne('/api/auth/refresh').request.body).toEqual({ refreshToken: 'ref-2' });
    });

    it('falla sin llamar al backend si no hay refresh token', () => {
      const auth = crear();
      let fallo = false;
      auth.refresh().subscribe({ error: () => (fallo = true) });
      expect(fallo).toBe(true);
      http.expectNone('/api/auth/refresh');
    });
  });

  describe('cambio de clave obligatorio', () => {
    it('una cuenta con clave provisional queda marcada hasta que cambia su clave', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ mustChangePassword: true }) });
      expect(auth.mustChangePassword()).toBe(true);

      auth.changePassword('provisional-1', 'mi-clave-nueva-2026').subscribe();
      const req = http.expectOne('/api/auth/change-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'provisional-1', newPassword: 'mi-clave-nueva-2026' });
      req.flush(respuesta({ accessToken: 'acc-nuevo', refreshToken: 'ref-nuevo', user: usuario({ mustChangePassword: false }) }));

      expect(auth.mustChangePassword()).toBe(false);
      expect(auth.getToken()).toBe('acc-nuevo');
      expect(auth.getRefreshToken()).toBe('ref-nuevo');
    });

    it('una cuenta normal no tiene cambio pendiente', () => {
      const auth = crear();
      iniciarSesion(auth);
      expect(auth.mustChangePassword()).toBe(false);
    });

    it('marcarCambioClavePendiente enciende la marca cuando el backend avisa de un cambio que la sesión no conocía', () => {
      const auth = crear();
      iniciarSesion(auth);
      auth.marcarCambioClavePendiente();
      expect(auth.mustChangePassword()).toBe(true);
    });
  });

  describe('logout', () => {
    it('avisa al backend con el refresh token y limpia la sesión local', () => {
      const auth = crear();
      iniciarSesion(auth, { user: usuario({ roleCode: 'superadmin' }) });

      auth.logout();
      const req = http.expectOne('/api/auth/logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'ref-1' });
      req.flush({ ok: true });

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.currentUser()).toBeNull();
      expect(auth.getRefreshToken()).toBeNull();
      expect(auth.puedeActuarComo()).toBe(false);
      expect(localStorage.getItem('dynadrill_refresh_token')).toBeNull();
      expect(localStorage.getItem('dynadrill_access_token')).toBeNull();
    });

    it('ignora un error del backend: la sesión local se cierra igual', () => {
      const auth = crear();
      iniciarSesion(auth);

      auth.logout();
      http.expectOne('/api/auth/logout').flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });

      expect(auth.isAuthenticated()).toBe(false);
    });

    it('sin refresh token no llama al backend', () => {
      localStorage.setItem('dynadrill_access_token', 'acc-x');
      localStorage.setItem('dynadrill_current_user', JSON.stringify(usuario()));
      const auth = crear();

      auth.logout();

      http.expectNone('/api/auth/logout');
      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
