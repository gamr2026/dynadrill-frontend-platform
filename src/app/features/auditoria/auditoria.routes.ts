import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { PERMISO_AUDITORIA } from './models/auditoria.model';

export const auditoriaRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/auditoria-page').then((m) => m.AuditoriaPage),
    canActivate: [permissionGuard(PERMISO_AUDITORIA)],
  },
];
