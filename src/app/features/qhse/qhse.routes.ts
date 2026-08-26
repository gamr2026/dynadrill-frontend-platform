import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Fase 1 del módulo QHSE (HSE-PLAN-001 / HSE-SITIO-001): IPERC + PTW.
 * Fase 2 (control operativo diario, HSE-SEGUIMIENTO-001/002/003):
 * Inspecciones, Tarjetas STOP y Stop Work Authority. Ver plan de
 * desarrollo del proyecto. El resto de fases se agrega como rutas
 * hermanas a medida que se construyen.
 */
const HSE_STAFF_ROLES = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE'];

/**
 * HSE-SITIO-001 asigna explícitamente "Firmar PTW y Actas" al Supervisor
 * Operativo (sección Responsabilidades) — a diferencia de IPERC, donde el
 * Supervisor solo "conoce la viabilidad operativa" sin firmar nada, PTW sí
 * necesita que el rol Supervisor entre al módulo.
 */
const PTW_ROLES = [...HSE_STAFF_ROLES, 'Supervisor'];

export const qhseRoutes: Routes = [
  { path: '', redirectTo: 'iperc', pathMatch: 'full' },
  {
    path: 'iperc',
    loadComponent: () => import('./iperc/pages/iperc-list-page/iperc-list-page').then(m => m.IpercListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'iperc/:id',
    loadComponent: () => import('./iperc/pages/iperc-detail-page/iperc-detail-page').then(m => m.IpercDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'ptw',
    loadComponent: () => import('./ptw/pages/ptw-list-page/ptw-list-page').then(m => m.PtwListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PTW_ROLES },
  },
  {
    path: 'ptw/:id',
    loadComponent: () => import('./ptw/pages/ptw-detail-page/ptw-detail-page').then(m => m.PtwDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: PTW_ROLES },
  },
  {
    path: 'inspecciones',
    loadComponent: () => import('./inspecciones/pages/inspeccion-list-page/inspeccion-list-page').then(m => m.InspeccionListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'stop',
    loadComponent: () => import('./stop/pages/stop-list-page/stop-list-page').then(m => m.StopListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
    // Igual que Indicadores de Mantenimiento: ECharts solo se paga en esta
    // ruta (Pareto de tendencias STOP), no en el bundle inicial.
    providers: [provideDynadrillCharts([BarChart])],
  },
  {
    path: 'eventos',
    loadComponent: () =>
      import('./eventos/pages/eventos-criticos-list-page/eventos-criticos-list-page').then(m => m.EventosCriticosListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'swa/:id',
    loadComponent: () => import('./swa/pages/swa-detail-page/swa-detail-page').then(m => m.SwaDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'desechos',
    loadComponent: () => import('./desechos/pages/desecho-list-page/desecho-list-page').then(m => m.DesechoListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'desechos/:id',
    loadComponent: () => import('./desechos/pages/desecho-detail-page/desecho-detail-page').then(m => m.DesechoDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'derrames/:id',
    loadComponent: () => import('./derrames/pages/derrame-detail-page/derrame-detail-page').then(m => m.DerrameDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'emergencias/:id',
    loadComponent: () => import('./emergencias/pages/emergencia-detail-page/emergencia-detail-page').then(m => m.EmergenciaDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'investigaciones/:id',
    loadComponent: () => import('./investigaciones/pages/investigacion-detail-page/investigacion-detail-page').then(m => m.InvestigacionDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/pages/qhse-dashboard-page/qhse-dashboard-page').then(m => m.QhseDashboardPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
];
