import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';

/**
 * Solo activo mientras no exista el backend NestJS real de auth. Se
 * registra condicionalmente en app.config.ts (isDevMode()) — nunca corre
 * en build de producción. Borrar este archivo y su registro en
 * app.config.ts cuando POST /api/auth/login exista de verdad.
 */
export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || !req.url.endsWith('/api/auth/login')) {
    return next(req);
  }

  return of(new HttpResponse({ status: 200, body: { accessToken: 'dev-mock-token' } })).pipe(delay(400));
};
