import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';

const FCR_ROLES = [
  'Superadmin',
  'Jefe de Base',
  'Supervisor',
  'Operador FCR',
  'Bodeguero',
  'Ingeniería de Ventas FCR',
  'Supervisor Operaciones FCR',
  // Firman "Liberado por QHSE" en el checklist de inspección por herramienta.
  'Técnico HSE',
  'Coordinador HSE',
  'Gerente HSE',
];

export const fcrRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ticket-list-page/ticket-list-page').then(m => m.FcrTicketListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FCR_ROLES },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/ticket-detail-page/ticket-detail-page').then(m => m.FcrTicketDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FCR_ROLES },
  },
];
