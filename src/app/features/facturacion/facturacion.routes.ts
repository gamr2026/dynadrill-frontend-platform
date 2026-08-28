import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

const FACTURACION_ROLES = ['Facturación', 'Superadmin', 'Jefe de Base'];

export const facturacionRoutes: Routes = [
  { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
  {
    path: 'pedidos',
    loadComponent: () => import('./pages/pedido-facturacion-list-page/pedido-facturacion-list-page').then(m => m.PedidoFacturacionListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'pedidos/:id',
    loadComponent: () => import('./pages/pedido-facturacion-detail-page/pedido-facturacion-detail-page').then(m => m.PedidoFacturacionDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'tickets',
    loadComponent: () => import('./pages/ticket-facturacion-list-page/ticket-facturacion-list-page').then(m => m.TicketFacturacionListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'tickets/:id',
    loadComponent: () => import('./pages/ticket-facturacion-detail-page/ticket-facturacion-detail-page').then(m => m.TicketFacturacionDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
];
