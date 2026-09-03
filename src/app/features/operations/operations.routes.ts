import { Routes } from '@angular/router';

export const operationsRoutes: Routes = [
  {
    path: 'pumping',
    loadChildren: () => import('./pumping/pumping.routes').then(m => m.pumpingRoutes),
  },
  {
    path: 'fcr',
    loadChildren: () => import('./fcr/fcr.routes').then(m => m.fcrRoutes),
  },
];
