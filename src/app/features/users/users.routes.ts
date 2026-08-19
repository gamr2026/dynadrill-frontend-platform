import { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/user-list-page').then(m => m.UserListPage) },
];
