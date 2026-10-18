import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

/** Flota (backend nuevo, `/api/operaciones/flota`). El acceso se decide por permiso, no por nombre de rol. */
export const flotaRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'unidades',
  },
  {
    path: 'unidades',
    loadComponent: () =>
      import('./pages/unidades-list-page/unidades-list-page').then((m) => m.UnidadesListPage),
    canActivate: [permissionGuard('flota.unidades.ver')],
  },
  {
    path: 'inspecciones',
    loadComponent: () =>
      import('./pages/inspecciones-page/inspecciones-page').then((m) => m.InspeccionesPage),
    canActivate: [permissionGuard('flota.inspecciones.ver')],
  },
  {
    path: 'conductores',
    loadComponent: () =>
      import('./pages/conductores-page/conductores-page').then((m) => m.ConductoresPage),
    canActivate: [permissionGuard('flota.conductores.ver')],
  },
  {
    path: 'unidades/:id',
    loadComponent: () =>
      import('./pages/unidad-detail-page/unidad-detail-page').then((m) => m.UnidadDetailPage),
    canActivate: [permissionGuard('flota.unidades.ver')],
  },
];
