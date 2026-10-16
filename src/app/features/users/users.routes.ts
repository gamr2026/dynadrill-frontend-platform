import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const usersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/user-list-page').then(m => m.UserListPage),
    canActivate: [permissionGuard('identidad.usuarios.ver')],
  },
];
