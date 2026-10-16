import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';
import { permissionGuard } from '../../../core/guards/permission.guard';
import { PUMPING_MANTENIMIENTO_ROLES } from './models/pumping.model';
import { PERMISO_PUMPING_OPERAR } from './tickets-nuevos/models/ticket-pumping';

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
  // Pedidos de Pumping del backend nuevo (contenedor operaciones): se autorizan por permiso del token, no por rol.
  {
    path: 'pedidos',
    loadComponent: () => import('./tickets-nuevos/pages/tickets-pumping-list-page/tickets-pumping-list-page').then(m => m.TicketsPumpingListPage),
    canActivate: [permissionGuard(PERMISO_PUMPING_OPERAR)],
  },
  {
    path: 'pedidos/:id',
    loadComponent: () => import('./tickets-nuevos/pages/ticket-pumping-detail-page/ticket-pumping-detail-page').then(m => m.TicketPumpingDetailPage),
    canActivate: [permissionGuard(PERMISO_PUMPING_OPERAR)],
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
    // Mantenimiento entra solo de lectura al card "Mantenimientos" (ver PUMPING_MANTENIMIENTO_ROLES).
    data: { allowedRoles: [...PUMPING_ROLES, ...Object.keys(PUMPING_MANTENIMIENTO_ROLES)] },
  },
];
