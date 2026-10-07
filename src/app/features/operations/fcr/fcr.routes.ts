import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/role.guard';

/** Roles que pueden abrir tickets de FCR — también lo usa el detalle del pedido para decidir si muestra "Ir a FCR". */
export const FCR_ROLES = [
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

/**
 * Configuran qué hace FCR con cada código de la Lista de Precios de un cliente
 * (backend `ModuleRoles.fcrConfiguracionCodigos`). Ingeniería de Ventas queda
 * afuera: Ventas y FCR no se cruzan (ver navigation.service.ts).
 */
export const FCR_CONFIGURACION_CODIGOS_ROLES = ['Superadmin', 'Jefe de Base', 'Ingeniería de Ventas FCR'];

export const fcrRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/ticket-list-page/ticket-list-page').then(m => m.FcrTicketListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FCR_ROLES },
  },
  // Antes de ':id' para que no se lea "configuracion-codigos" como id de ticket.
  {
    path: 'configuracion-codigos',
    loadComponent: () =>
      import('./pages/configuracion-codigos-page/configuracion-codigos-page').then(m => m.FcrConfiguracionCodigosPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FCR_CONFIGURACION_CODIGOS_ROLES },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/ticket-detail-page/ticket-detail-page').then(m => m.FcrTicketDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FCR_ROLES },
  },
];
