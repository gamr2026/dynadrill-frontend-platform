import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';

const PUMPING_ROLES = ['Jefe de Base', 'Supervisor', 'Operador'];

export const pumpingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ticket-list-page/ticket-list-page').then(m => m.TicketListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PUMPING_ROLES },
  },
  {
    path: 'aprobaciones',
    loadComponent: () => import('./pages/aprobaciones-page/aprobaciones-page').then(m => m.AprobacionesPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Supervisor'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/ticket-detail-page/ticket-detail-page').then(m => m.TicketDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PUMPING_ROLES },
  },
];
