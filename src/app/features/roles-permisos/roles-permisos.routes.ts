import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const rolesPermisosRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/roles-permisos-page').then(m => m.RolesPermisosPage),
    canActivate: [permissionGuard('identidad.roles.ver')],
  },
];
