import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';

const FACTURACION_ROLES = ['Facturación', 'Superadmin', 'Jefe de Base'];
/** Ventas también abre y consulta Pedidos (FACT-001), pero no prefacturas/AOT/reportería. */
const PEDIDO_ROLES = [...FACTURACION_ROLES, 'Ingeniería de Ventas'];
/** Catálogos de personas/clientes del Pedido — a pedido del cliente, solo Ventas los gestiona (ni Facturación). */
const VENTAS_CATALOGOS_ROLES = ['Superadmin', 'Jefe de Base', 'Ingeniería de Ventas'];

export const facturacionRoutes: Routes = [
  { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
  {
    path: 'pedidos',
    loadComponent: () => import('./pages/pedidos-list-page/pedidos-list-page').then(m => m.PedidosListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PEDIDO_ROLES },
  },
  {
    path: 'pedidos/:id',
    loadComponent: () => import('./pages/pedido-detail-page/pedido-detail-page').then(m => m.PedidoDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PEDIDO_ROLES },
  },
  {
    path: 'catalogos',
    loadComponent: () => import('./pages/catalogos-ventas-page/catalogos-ventas-page').then(m => m.CatalogosVentasPage),
    canActivate: [roleGuard],
    data: { allowedRoles: VENTAS_CATALOGOS_ROLES },
  },
  {
    path: 'lista-precios',
    loadComponent: () => import('./pages/lista-precios-page/lista-precios-page').then(m => m.ListaPreciosPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'lista-precios/:id',
    loadComponent: () => import('./pages/lista-precios-detail-page/lista-precios-detail-page').then(m => m.ListaPreciosDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'prefacturas',
    loadComponent: () => import('./pages/prefacturas-list-page/prefacturas-list-page').then(m => m.PrefacturasListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'prefacturas/:id',
    loadComponent: () => import('./pages/prefactura-detail-page/prefactura-detail-page').then(m => m.PrefacturaDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'aots/:id',
    loadComponent: () => import('./pages/aot-detail-page/aot-detail-page').then(m => m.AotDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
  },
  {
    path: 'reporteria',
    loadComponent: () => import('./pages/reporteria-page/reporteria-page').then(m => m.ReporteriaPage),
    canActivate: [roleGuard],
    data: { allowedRoles: FACTURACION_ROLES },
    providers: [provideDynadrillCharts([BarChart])],
  },
];
