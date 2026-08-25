import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then(m => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.dashboardRoutes),
      },
      {
        path: 'dashboard/usuarios',
        loadChildren: () => import('./features/users/users.routes').then(m => m.usersRoutes),
      },
      {
        path: 'dashboard/mantenimiento',
        loadChildren: () => import('./features/maintenance/maintenance.routes').then(m => m.maintenanceRoutes),
      },
      {
        path: 'dashboard/qhse',
        loadChildren: () => import('./features/qhse/qhse.routes').then(m => m.qhseRoutes),
      },
      {
        path: 'modulos/operativo',
        loadChildren: () => import('./features/operations/operations.routes').then(m => m.operationsRoutes),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
