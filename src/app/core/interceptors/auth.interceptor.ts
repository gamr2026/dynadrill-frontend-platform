import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Adjunta el `Authorization: Bearer` a toda llamada saliente y, ante un 401
 * del backend (token vencido o inválido), cierra la sesión y manda al login.
 * El 401 del propio `/api/auth/login` (credenciales incorrectas) se deja
 * pasar — lo maneja la página de login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/api/auth/login')) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
