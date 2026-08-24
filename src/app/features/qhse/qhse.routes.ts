import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Fase 1 del módulo QHSE (HSE-PLAN-001 / HSE-SITIO-001, ver plan de
 * desarrollo en el proyecto): IPERC + PTW/Recibimiento de Sitio. El resto
 * de fases se agrega como rutas hermanas a medida que se construyen.
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
];
