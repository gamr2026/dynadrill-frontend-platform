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
    path: 'kpis',
    loadComponent: () => import('./pages/maintenance-kpis-page').then(m => m.MaintenanceKpisPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Jefe de Mantenimiento'] },
    // Solo esta ruta paga el costo de ECharts — provideDynadrillCharts
    // registrado a nivel de app.config.ts pondría el import estático de
    // echarts/charts en main.js (bundle inicial de TODOS los usuarios).
    // Con tree-shaking real: solo bar/line/gauge, lo que hoy usan los KPIs.
    providers: [provideDynadrillCharts([BarChart, LineChart, GaugeChart])],
  },
  {
    path: 'inspeccion-vehiculos',
    loadComponent: () => import('./pages/vehicle-inspection-page').then(m => m.VehicleInspectionPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Conductor', 'Supervisor'] },
  },
];
