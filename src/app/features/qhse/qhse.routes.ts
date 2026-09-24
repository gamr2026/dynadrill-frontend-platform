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
/**
 * Superadmin/Jefe de Base ven todos los módulos (ver sidebar.ts) — sin
 * esto acá, el enlace de QHSE que sí les aparece en el sidebar los
 * mandaría de vuelta a /dashboard al hacer clic (roleGuard).
 */
const HSE_STAFF_ROLES = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE', 'Superadmin', 'Jefe de Base'];

/**
 * El Supervisor NO entra a QHSE — "Firmar PTW y Actas" quedó mal asignado
 * acá en una iteración anterior (HSE-SITIO-001 lo asigna al staff HSE, no
 * al Supervisor Operativo); corregido a pedido del cliente.
 */
const PTW_ROLES = [...HSE_STAFF_ROLES];

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
    path: 'aspectos-ambientales',
    loadComponent: () =>
      import('./aspectos-ambientales/pages/aspecto-ambiental-list-page/aspecto-ambiental-list-page').then(m => m.AspectoAmbientalListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'legal',
    loadComponent: () => import('./legal/pages/legal-page/legal-page').then(m => m.LegalPage),
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
  {
    path: 'epi',
    loadComponent: () => import('./epi/pages/epi-list-page/epi-list-page').then(m => m.EpiListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    // Fase 2, PLAN-QHSE-PUMPING-NOTIFICACIONES: bandeja "Documentos por pedido".
    path: 'documentos',
    loadComponent: () =>
      import('./documentos/pages/documentos-pedidos-page/documentos-pedidos-page').then(m => m.DocumentosPedidosPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    // Fase 4, PLAN-QHSE-PUMPING-NOTIFICACIONES: checklist QHSE por equipo (D5).
    path: 'checklist-equipos',
    loadComponent: () =>
      import('./checklist-equipos/pages/checklist-equipos-page/checklist-equipos-page').then(m => m.ChecklistEquiposPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
];
