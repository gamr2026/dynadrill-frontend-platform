import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Exige que el rol efectivo tenga el permiso indicado (o, con varios, al menos uno). Si no lo tiene redirige al
 * dashboard, igual que `roleGuard`. Uso: `canActivate: [permissionGuard('identidad.roles.ver')]`.
 */
export const permissionGuard =
  (...codigos: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.canAny(...codigos) ? true : router.createUrlTree(['/dashboard']);
  };
