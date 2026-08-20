import { Routes } from '@angular/router';

export const pumpingRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/ticket-list-page/ticket-list-page').then(m => m.TicketListPage) },
  { path: ':id', loadComponent: () => import('./pages/ticket-detail-page/ticket-detail-page').then(m => m.TicketDetailPage) },
];
