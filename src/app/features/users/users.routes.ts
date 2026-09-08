import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/** Coincide con la visibilidad del link "Usuarios" en sidebar.ts. */
const USERS_ROLES = ['Superadmin', 'Jefe de Base'];

export const usersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/user-list-page').then(m => m.UserListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: USERS_ROLES },
  },
];
