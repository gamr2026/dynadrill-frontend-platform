import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Bodeguero es el rol dedicado; Jefe de Mantenimiento conserva acceso
 * porque ya administraba Unidades acá antes de que existiera Bodeguero.
 * Superadmin/Jefe de Base ven todos los módulos (ver sidebar.ts).
 */
const INVENTARIO_ROLES = ['Bodeguero', 'Jefe de Mantenimiento', 'Superadmin', 'Jefe de Base'];

export const inventarioRoutes: Routes = [
  { path: '', redirectTo: 'articulos', pathMatch: 'full' },
  {
    path: 'articulos',
    loadComponent: () => import('./pages/articulo-list-page/articulo-list-page').then(m => m.ArticuloListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: INVENTARIO_ROLES },
  },
  {
    path: 'articulos/:id',
    loadComponent: () => import('./pages/articulo-detail-page/articulo-detail-page').then(m => m.ArticuloDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: INVENTARIO_ROLES },
  },
  {
    path: 'vehiculos',
    loadComponent: () => import('./pages/vehiculos-list-page/vehiculos-list-page').then(m => m.VehiculosListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: INVENTARIO_ROLES },
  },
];
