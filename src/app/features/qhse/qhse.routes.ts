import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

/**
 * Fase 1 del módulo QHSE (HSE-PLAN-001 / HSE-SITIO-001, ver plan de
 * desarrollo en el proyecto): arranca solo con IPERC. PTW/Recibimiento de
 * Sitio y el resto de fases se agregan como rutas hermanas a medida que se
 * construyen.
 */
const HSE_STAFF_ROLES = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE'];

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
];
