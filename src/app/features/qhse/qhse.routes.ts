import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { BarChart } from 'echarts/charts';
import { roleGuard } from '../../core/guards/role.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { PERMISO_EPI_VER } from './entrega-epi/models/entrega-epi';
import { PERMISO_DOCUMENTOS_VER } from './documentos-pedido/models/documento-pedido';
import { PERMISO_PTW_VER } from './permiso-trabajo/models/permiso-trabajo';
import { PERMISO_SWA_VER } from './swa-plataforma/models/swa';

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
const HSE_STAFF_ROLES = [
  'Técnico HSE',
  'Coordinador HSE',
  'Gerente HSE',
  'Superadmin',
  'Jefe de Base',
];

export const qhseRoutes: Routes = [
  { path: '', redirectTo: 'iperc', pathMatch: 'full' },
  // Hubs móviles (Figma "M · QHSE · … (hub)"): los destinos de la barra inferior.
  {
    path: 'planificacion',
    loadComponent: () => import('./hubs/qhse-hub-page').then((m) => m.QhseHubPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES, hub: 'planificacion' },
  },
  {
    path: 'registros',
    loadComponent: () => import('./hubs/qhse-hub-page').then((m) => m.QhseHubPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES, hub: 'registros' },
  },
  {
    path: 'eventos-criticos',
    loadComponent: () => import('./hubs/qhse-hub-page').then((m) => m.QhseHubPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES, hub: 'eventos' },
  },
  {
    path: 'iperc',
    loadComponent: () =>
      import('./iperc/pages/iperc-list-page/iperc-list-page').then((m) => m.IpercListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'iperc/:id',
    loadComponent: () =>
      import('./iperc/pages/iperc-detail-page/iperc-detail-page').then((m) => m.IpercDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    // PTW del backend nuevo (contenedor qhse, `/api/v2/qhse/ptw`): se autoriza por permiso del token. El detalle se abre en un diálogo;
    // las pantallas de la demo (`./ptw`) quedan sin ruta hasta el Corte.
    path: 'ptw',
    loadComponent: () =>
      import('./permiso-trabajo/pages/ptw-list-page/ptw-list-page').then((m) => m.PtwListPage),
    canActivate: [permissionGuard(PERMISO_PTW_VER)],
  },
  {
    path: 'inspecciones',
    loadComponent: () =>
      import('./inspecciones/pages/inspeccion-list-page/inspeccion-list-page').then(
        (m) => m.InspeccionListPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'stop',
    loadComponent: () =>
      import('./stop/pages/stop-list-page/stop-list-page').then((m) => m.StopListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
    // Igual que Indicadores de Mantenimiento: ECharts solo se paga en esta
    // ruta (Pareto de tendencias STOP), no en el bundle inicial.
    providers: [provideDynadrillCharts([BarChart])],
  },
  {
    path: 'eventos',
    loadComponent: () =>
      import('./eventos/pages/eventos-criticos-list-page/eventos-criticos-list-page').then(
        (m) => m.EventosCriticosListPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    // SWA del backend nuevo (contenedor qhse, `/api/v2/qhse/swa`): se autoriza por permiso del token. El detalle se abre en un diálogo;
    // la pantalla de la demo (`swa/:id`) queda sin enlaces hasta el Corte.
    path: 'swa',
    loadComponent: () =>
      import('./swa-plataforma/pages/swa-list-page/swa-list-page').then((m) => m.SwaListPage),
    canActivate: [permissionGuard(PERMISO_SWA_VER)],
  },
  {
    path: 'swa/:id',
    loadComponent: () =>
      import('./swa/pages/swa-detail-page/swa-detail-page').then((m) => m.SwaDetailPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'desechos',
    loadComponent: () =>
      import('./desechos/pages/desecho-list-page/desecho-list-page').then((m) => m.DesechoListPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'desechos/:id',
    loadComponent: () =>
      import('./desechos/pages/desecho-detail-page/desecho-detail-page').then(
        (m) => m.DesechoDetailPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'aspectos-ambientales',
    loadComponent: () =>
      import('./aspectos-ambientales/pages/aspecto-ambiental-list-page/aspecto-ambiental-list-page').then(
        (m) => m.AspectoAmbientalListPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'legal',
    loadComponent: () => import('./legal/pages/legal-page/legal-page').then((m) => m.LegalPage),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'objetivos-ambientales',
    loadComponent: () =>
      import('./objetivos-ambientales/pages/objetivo-ambiental-list-page/objetivo-ambiental-list-page').then(
        (m) => m.ObjetivoAmbientalListPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'derrames/:id',
    loadComponent: () =>
      import('./derrames/pages/derrame-detail-page/derrame-detail-page').then(
        (m) => m.DerrameDetailPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'emergencias/:id',
    loadComponent: () =>
      import('./emergencias/pages/emergencia-detail-page/emergencia-detail-page').then(
        (m) => m.EmergenciaDetailPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'investigaciones/:id',
    loadComponent: () =>
      import('./investigaciones/pages/investigacion-detail-page/investigacion-detail-page').then(
        (m) => m.InvestigacionDetailPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/pages/qhse-dashboard-page/qhse-dashboard-page').then(
        (m) => m.QhseDashboardPage,
      ),
    canActivate: [roleGuard],
    data: { allowedRoles: HSE_STAFF_ROLES },
  },
  {
    // Entrega de EPI del backend nuevo (contenedor qhse, `/api/v2/qhse/epi`): se autoriza por permiso del token, no por rol.
    path: 'epi',
    loadComponent: () =>
      import('./entrega-epi/pages/entrega-epi-list-page/entrega-epi-list-page').then(
        (m) => m.EntregaEpiListPage,
      ),
    canActivate: [permissionGuard(PERMISO_EPI_VER)],
  },
  {
    // Documentos por pedido del backend nuevo (contenedor qhse, `/api/v2/qhse/documentos`): se autoriza por permiso del token.
    // La pantalla de la demo (`./documentos`) queda sin ruta hasta el Corte.
    path: 'documentos',
    loadComponent: () =>
      import('./documentos-pedido/pages/documentos-pedido-page/documentos-pedido-page').then(
        (m) => m.DocumentosPedidoPage,
      ),
    canActivate: [permissionGuard(PERMISO_DOCUMENTOS_VER)],
  },
];
