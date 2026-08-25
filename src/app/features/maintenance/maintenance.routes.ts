import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart, GaugeChart, LineChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';

export const maintenanceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/maintenance-list-page').then(m => m.MaintenanceListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Jefe de Mantenimiento'] },
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
    data: { allowedRoles: ['Jefe de Mantenimiento'] },
    providers: [provideDynadrillCharts([BarChart, LineChart, GaugeChart])],
  },
];
