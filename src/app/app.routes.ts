import { Routes } from '@angular/router';
import { authGuard, sessionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'cambiar-clave',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/auth/pages/change-password-page').then((m) => m.ChangePasswordPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
      },
      {
        path: 'dashboard/usuarios',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
      },
      {
        path: 'roles-permisos',
        loadChildren: () =>
          import('./features/roles-permisos/roles-permisos.routes').then(
            (m) => m.rolesPermisosRoutes,
          ),
      },
      {
        path: 'dashboard/mantenimiento',
        loadChildren: () =>
          import('./features/maintenance/maintenance.routes').then((m) => m.maintenanceRoutes),
      },
      {
        path: 'dashboard/flota',
        loadChildren: () => import('./features/flota/flota.routes').then((m) => m.flotaRoutes),
      },
      {
        path: 'dashboard/qhse',
        loadChildren: () => import('./features/qhse/qhse.routes').then((m) => m.qhseRoutes),
      },
      {
        path: 'dashboard/inventario',
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then((m) => m.inventarioRoutes),
      },
      {
        path: 'dashboard/facturacion',
        loadChildren: () =>
          import('./features/facturacion/facturacion.routes').then((m) => m.facturacionRoutes),
      },
      {
        path: 'modulos/operativo',
        loadChildren: () =>
          import('./features/operations/operations.routes').then((m) => m.operationsRoutes),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
