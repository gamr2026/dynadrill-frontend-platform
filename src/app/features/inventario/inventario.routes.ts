import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Acceso provisional: solo Jefe de Mantenimiento, el mismo rol que ya
 * administra Unidades en Mantenimiento. Si más adelante se define un rol
 * propio de Inventario (ej. "Encargado de Bodega"), es un cambio de una
 * línea acá.
 */
const INVENTARIO_ROLES = ['Jefe de Mantenimiento'];

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
