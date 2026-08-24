import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { getMockRoles, getMockUsers } from './users-mock.interceptor';

/**
 * Solo activo mientras no exista el backend NestJS real de auth. Se
 * registra condicionalmente en app.config.ts (isDevMode()) — nunca corre
 * en build de producción. Borrar este archivo y su registro en
 * app.config.ts cuando POST /api/auth/login exista de verdad.
 *
 * Sin validación de password: cualquier contraseña entra si el email
 * coincide con un usuario sembrado — es solo para pruebas manuales de rol.
 */
export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || !req.url.endsWith('/api/auth/login')) {
    return next(req);
  }

  const { email } = req.body as { email: string; password: string };
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
