import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Requiere `data: { allowedRoles: string[] }` en la ruta. */
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['allowedRoles'] as string[] | undefined;
  const roleName = auth.currentUser()?.roleName;

  return !allowedRoles || (roleName != null && allowedRoles.includes(roleName)) ? true : router.createUrlTree(['/dashboard']);
};
