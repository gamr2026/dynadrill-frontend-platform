import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Rutas de autenticación cuyo 401 NO se intenta renovar: es una respuesta legítima (credenciales
 * incorrectas, refresh token vencido o ya usado) o su renovación provocaría un bucle
 * (`refresh` → 401 → `refresh`...). `/auth/switch-role` se excluye porque se invoca durante la propia renovación.
 */
const RUTAS_SIN_RENOVACION = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/switch-role'];

const conToken = (req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Adjunta el `Authorization: Bearer` a toda llamada saliente y, ante un 401 del backend (access
 * token vencido o inválido), intenta UNA renovación con el refresh token y reintenta la petición
 * original con el token nuevo. Solo si la renovación falla (o el reintento vuelve a dar 401) cierra
 * la sesión y manda al login.
 *
 * La renovación es "single-flight" (ver `AuthService.refresh`): varias peticiones que fallen a la
 * vez comparten una sola, porque cada refresh token sirve una única vez. Una petición que falla
 * con un token que otra renovación ya reemplazó solo se reintenta con el token vigente.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tokenEnviado = auth.getToken();

  const cerrarSesion = (): void => {
    auth.logout();
    void router.navigate(['/login']);
  };

  const reintentar = (token: string | null): ReturnType<typeof next> =>
    next(conToken(req, token)).pipe(
      catchError((error: unknown) => {
        // Un segundo 401 con el token recién renovado: no hay más que intentar (evita bucles).
        if (error instanceof HttpErrorResponse && error.status === 401) cerrarSesion();
        return throwError(() => error);
      }),
    );

  return next(conToken(req, tokenEnviado)).pipe(
    catchError((error: unknown) => {
      // Clave provisional sin cambiar: el backend responde 403 a todo lo demás. No es un token vencido.
      if (error instanceof HttpErrorResponse && error.status === 403 && error.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
        auth.marcarCambioClavePendiente();
        void router.navigate(['/cambiar-clave']);
        return throwError(() => error);
      }

      const esRutaExcluida = RUTAS_SIN_RENOVACION.some(ruta => req.url.includes(ruta));
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || esRutaExcluida) {
        return throwError(() => error);
      }

      // Sin refresh token no hay con qué renovar: sesión vencida.
      if (!auth.getRefreshToken()) {
        cerrarSesion();
        return throwError(() => error);
      }

      // Otra petición ya renovó mientras esta viajaba: basta reintentar con el token vigente.
      const vigente = auth.getToken();
      const renovado$: Observable<string | null> =
        vigente && vigente !== tokenEnviado ? of(vigente) : auth.refresh().pipe(map(() => auth.getToken()));

      return renovado$.pipe(
        catchError((refreshError: unknown) => {
          // Un fallo de red o del servidor (0, 5xx) no prueba que la sesión sea inválida: se conserva y se
          // devuelve el 401 original. Cualquier otro rechazo del refresh (401/400/403, token reusado) cierra la sesión.
          const esFalloTransitorio =
            refreshError instanceof HttpErrorResponse && (refreshError.status === 0 || refreshError.status >= 500);
          if (!esFalloTransitorio) cerrarSesion();
          return throwError(() => error);
        }),
        switchMap(token => reintentar(token)),
      );
    }),
  );
};
