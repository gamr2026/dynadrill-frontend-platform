import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Exige sesión; si la clave es provisional, solo deja pasar a la pantalla de cambio de clave. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return auth.mustChangePassword() ? router.createUrlTree(['/cambiar-clave']) : true;
};

/** Exige sesión pero NO redirige por clave provisional: es el guard de la propia pantalla de cambio de clave. */
export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};
