import { Routes } from '@angular/router';

export const maintenanceRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/maintenance-list-page').then(m => m.MaintenanceListPage) },
];
