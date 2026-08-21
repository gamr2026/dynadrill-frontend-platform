import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { delay, of, throwError } from 'rxjs';
import { getMockRoles, getMockUsers } from './users-mock.interceptor';

/**
 * Solo activo mientras no exista el backend NestJS real de auth. Se
 * registra condicionalmente en app.config.ts (isDevMode()) — nunca corre
 * en build de producción. Borrar este archivo y su registro en
 * app.config.ts cuando POST /api/auth/login exista de verdad.
 *
 * Los usuarios del módulo de Mantenimiento necesitan clave real (para poder
 * loguearse como cada rol y ver su vista correspondiente) — el resto de
 * usuarios sembrados en users-mock.interceptor.ts se quedan aceptando
 * cualquier password, como antes, para no romper pruebas manuales ya en
 * curso de otros módulos.
 */
const HARDCODED_PASSWORDS: Record<string, string> = {
  'jefe.mantenimiento@dynadrill.com': 'Mantenimiento2026',
  'operador.mecanico@dynadrill.com': 'Mantenimiento2026',
  'operador.instrumental@dynadrill.com': 'Mantenimiento2026',
};

export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || !req.url.endsWith('/api/auth/login')) {
    return next(req);
  }

  const { email, password } = req.body as { email: string; password: string };
  const requiredPassword = HARDCODED_PASSWORDS[email];
  if (requiredPassword && password !== requiredPassword) {
    return throwError(() => new HttpErrorResponse({ status: 401 })).pipe(delay(400));
  }

  const user = getMockUsers().find(u => u.email === email);
  const role = user ? getMockRoles().find(r => r.id === user.roleId) : undefined;

  const body = {
    accessToken: 'dev-mock-token',
    user: user
      ? { id: user.id, name: user.name, email: user.email, roleId: user.roleId, roleName: role?.name ?? '' }
      : null,
  };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(400));
};
