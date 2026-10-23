import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { PERMISO_ENCUESTAS } from './models/encuestas.model';

/** Administración de encuestas (solo Superadmin). El formulario público del cliente va aparte, fuera del shell (`encuesta/:token`). */
export const encuestasRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/encuestas-page').then((m) => m.EncuestasPage),
    canActivate: [permissionGuard(PERMISO_ENCUESTAS)],
  },
  {
    path: 'versiones/:versionId',
    loadComponent: () => import('./pages/encuesta-editor-page').then((m) => m.EncuestaEditorPage),
    canActivate: [permissionGuard(PERMISO_ENCUESTAS)],
  },
];
