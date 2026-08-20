import { Routes } from '@angular/router';

export const operationsRoutes: Routes = [
  {
    path: 'pumping',
    loadChildren: () => import('./pumping/pumping.routes').then(m => m.pumpingRoutes),
  },
];
