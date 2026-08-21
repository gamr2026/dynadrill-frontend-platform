import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const maintenanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/maintenance-list-page').then(m => m.MaintenanceListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Jefe de Mantenimiento'] },
  },
  {
    path: 'mis-tareas',
    loadComponent: () => import('./pages/my-tasks-page').then(m => m.MyTasksPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Operador de Mantenimiento'] },
  },
];
