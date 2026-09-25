import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';

/** Superadmin/Jefe de Base ven todos los módulos (ver sidebar.ts). */
const JEFE_MANTENIMIENTO_ROLES = ['Jefe de Mantenimiento', 'Superadmin', 'Jefe de Base'];
/**
 * Autoriza/rechaza Gerenciamiento de Viaje — mismo criterio que
 * ModuleRoles.gerenciamientoViajeApprove en el backend (sin Jefe de
 * Mantenimiento): Jefe de Base/Superadmin gestionan cualquier nivel,
 * Supervisor Pumping solo BAJO (el corte real por nivel de riesgo lo aplica
 * el backend, esto solo decide quién entra a la página).
 */
const GERENCIAMIENTO_VIAJE_APPROVE_ROLES = ['Jefe de Base', 'Superadmin', 'Supervisor Pumping', 'Gerente HSE'];

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
    // 'Operador FCR' también entra: sub-órdenes "Operativo" derivadas de un ticket FCR
    // llegan a la misma bandeja (ver ModuleRoles.maintenanceOperatorTasks en el backend).
    data: { allowedRoles: ['Operador', 'Operador FCR'] },
  },
  {
    path: 'kpis',
    loadComponent: () => import('./pages/maintenance-kpis-page').then(m => m.MaintenanceKpisPage),
    canActivate: [roleGuard],
    data: { allowedRoles: JEFE_MANTENIMIENTO_ROLES },
    providers: [provideDynadrillCharts([BarChart, LineChart, GaugeChart, PieChart])],
  },
  {
    path: 'gerenciamiento-viaje',
    loadComponent: () => import('./pages/gerenciamiento-viaje-page/gerenciamiento-viaje-page').then(m => m.GerenciamientoViajePage),
    canActivate: [roleGuard],
    data: { allowedRoles: GERENCIAMIENTO_VIAJE_APPROVE_ROLES },
  },
  {
    path: 'mis-viajes',
    loadComponent: () => import('../conductor/pages/mis-viajes-page/mis-viajes-page').then(m => m.MisViajesPage),
    canActivate: [roleGuard],
    data: { allowedRoles: ['Conductor'] },
  },
];
