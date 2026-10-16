import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const usuario = {
  id: '0b5e7c1e-0000-4000-8000-000000000001',
  legacyId: 7,
  name: 'Ana Torres',
  email: 'ana@dynadrill.com',
  roleId: '0b5e7c1e-0000-4000-8000-0000000000aa',
  roleLegacyId: 4,
  roleName: 'Jefe de Base',
  roleCode: 'jefe_base',
  permissions: [] as string[],
};

const sesionRenovada = { accessToken: 'acc-2', refreshToken: 'ref-2', expiresIn: 900, user: usuario };
const noAutorizado = { message: 'Unauthorized', statusCode: 401 };
const respuesta401 = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let auth: AuthService;
  const navigate = vi.fn();

  function crear(conRefreshToken = true): void {
    localStorage.clear();
    localStorage.setItem('dynadrill_access_token', 'acc-1');
    if (conRefreshToken) localStorage.setItem('dynadrill_refresh_token', 'ref-1');
    localStorage.setItem('dynadrill_current_user', JSON.stringify(usuario));
    navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  }

  const bearer = (req: TestRequest): string | null => req.request.headers.get('Authorization');

  afterEach(() => mock.verify());

  it('adjunta el Bearer a las peticiones salientes', () => {
    crear();
    http.get('/api/pedidos').subscribe();
    const req = mock.expectOne('/api/pedidos');
    expect(bearer(req)).toBe('Bearer acc-1');
    req.flush([]);
  });

  it('varias peticiones simultáneas con 401 disparan UN solo refresh y todas se reintentan con el token nuevo', () => {
    crear();
    const urls = ['/api/a', '/api/b', '/api/c'];
    const respuestas: Record<string, unknown> = {};
    for (const url of urls) http.get(url).subscribe(r => (respuestas[url] = r));

    for (const url of urls) mock.expectOne(url).flush(noAutorizado, respuesta401);

    const refresh = mock.expectOne('/api/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'ref-1' });
    refresh.flush(sesionRenovada);

    for (const url of urls) {
      const reintento = mock.expectOne(url);
      expect(bearer(reintento)).toBe('Bearer acc-2');
      reintento.flush({ ok: url });
    }
    expect(respuestas).toEqual({ '/api/a': { ok: '/api/a' }, '/api/b': { ok: '/api/b' }, '/api/c': { ok: '/api/c' } });
    expect(auth.getRefreshToken()).toBe('ref-2');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('una petición que falló con un token ya reemplazado se reintenta con el vigente sin renovar otra vez', () => {
    crear();
    http.get('/api/lenta').subscribe();
    http.get('/api/rapida').subscribe();
    const lenta = mock.expectOne('/api/lenta');
    const rapida = mock.expectOne('/api/rapida');

    rapida.flush(noAutorizado, respuesta401);
    mock.expectOne('/api/auth/refresh').flush(sesionRenovada);
    mock.expectOne('/api/rapida').flush({});

    lenta.flush(noAutorizado, respuesta401);
    // Sin un segundo /auth/refresh (el refresh token anterior ya se usó): solo el reintento.
    const reintento = mock.expectOne('/api/lenta');
    expect(bearer(reintento)).toBe('Bearer acc-2');
    reintento.flush({});
  });

  it('si el refresh falla cierra la sesión, manda a /login y propaga el error original', () => {
    crear();
    let status = 0;
    http.get('/api/a').subscribe({ error: e => (status = e.status) });

    mock.expectOne('/api/a').flush(noAutorizado, respuesta401);
    mock.expectOne('/api/auth/refresh').flush({ message: 'vencido' }, respuesta401);
    // El logout avisa al backend porque el refresh token anterior sigue guardado.
    mock.match('/api/auth/logout').forEach(r => r.flush({ ok: true }));

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('un fallo de red o del servidor al renovar no cierra la sesión', () => {
    crear();
    http.get('/api/a').subscribe({ error: () => undefined });

    mock.expectOne('/api/a').flush(noAutorizado, respuesta401);
    mock.expectOne('/api/auth/refresh').flush('caído', { status: 503, statusText: 'Service Unavailable' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('si el reintento vuelve a dar 401 cierra la sesión sin renovar de nuevo (sin bucles)', () => {
    crear();
    http.get('/api/a').subscribe({ error: () => undefined });

    mock.expectOne('/api/a').flush(noAutorizado, respuesta401);
    mock.expectOne('/api/auth/refresh').flush(sesionRenovada);
    mock.expectOne('/api/a').flush(noAutorizado, respuesta401);
    mock.match('/api/auth/logout').forEach(r => r.flush({ ok: true }));

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('sin refresh token, un 401 cierra la sesión directamente', () => {
    crear(false);
    http.get('/api/a').subscribe({ error: () => undefined });

    mock.expectOne('/api/a').flush(noAutorizado, respuesta401);

    mock.expectNone('/api/auth/refresh');
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('el 401 de /api/auth/login (credenciales inválidas) se deja pasar sin renovar ni cerrar sesión', () => {
    crear();
    let status = 0;
    http.post('/api/auth/login', {}).subscribe({ error: e => (status = e.status) });

    mock.expectOne('/api/auth/login').flush(noAutorizado, respuesta401);

    expect(status).toBe(401);
    mock.expectNone('/api/auth/refresh');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un 403 PASSWORD_CHANGE_REQUIRED manda a cambiar la clave, sin renovar ni cerrar la sesión', () => {
    crear();
    let error: unknown;
    http.get('/api/users').subscribe({ error: e => (error = e) });
    mock
      .expectOne('/api/users')
      .flush({ code: 'PASSWORD_CHANGE_REQUIRED', statusCode: 403 }, { status: 403, statusText: 'Forbidden' });

    expect(error).toBeTruthy();
    expect(auth.mustChangePassword()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/cambiar-clave']);
    mock.expectNone('/api/auth/refresh');
    expect(auth.isAuthenticated()).toBe(true);
  });
});
