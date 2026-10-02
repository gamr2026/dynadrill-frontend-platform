import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';

/** Roles que pueden abrir tickets de Pumping — también lo usa el detalle del pedido para decidir si muestra "Ir a Pumping". */
export const PUMPING_ROLES = ['Superadmin', 'Jefe de Base', 'Supervisor', 'Supervisor Pumping', 'Operador'];
// El Conductor entra solo a la lista (ve sus tareas), no al detalle del ticket.
const PUMPING_LIST_ROLES = [...PUMPING_ROLES, 'Conductor'];

export const pumpingRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ticket-list-page/ticket-list-page').then(m => m.TicketListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PUMPING_LIST_ROLES },
  },
  {
    path: 'aprobaciones',
    loadComponent: () => import('./pages/aprobaciones-page/aprobaciones-page').then(m => m.AprobacionesPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Supervisor', 'Supervisor Pumping'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/ticket-detail-page/ticket-detail-page').then(m => m.TicketDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PUMPING_ROLES },
  },
];
