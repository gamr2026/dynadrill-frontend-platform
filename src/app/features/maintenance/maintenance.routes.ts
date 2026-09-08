import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';

/** Superadmin/Jefe de Base ven todos los módulos (ver sidebar.ts). */
const JEFE_MANTENIMIENTO_ROLES = ['Jefe de Mantenimiento', 'Superadmin', 'Jefe de Base'];

export const maintenanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/maintenance-list-page').then(m => m.MaintenanceListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: JEFE_MANTENIMIENTO_ROLES },
  },
  {
    path: 'mis-tareas',
    loadComponent: () => import('./pages/my-tasks-page').then(m => m.MyTasksPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Operador de Mantenimiento'] },
  },
  {
    path: 'operativo',
    loadComponent: () => import('./pages/operator-maintenance-page').then(m => m.OperatorMaintenancePage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Operador'] },
  },
  {
    path: 'kpis',
    loadComponent: () => import('./pages/maintenance-kpis-page').then(m => m.MaintenanceKpisPage),
    canActivate: [roleGuard],
    data: { allowedRoles: JEFE_MANTENIMIENTO_ROLES },
    providers: [provideDynadrillCharts([BarChart, LineChart, GaugeChart, PieChart])],
  },
];
