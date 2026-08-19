import { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  { path: '', loadComponent: () => import('./pages/user-list-page').then(m => m.UserListPage) },
  { path: 'nuevo', loadComponent: () => import('./pages/user-form-page').then(m => m.UserFormPage) },
  { path: ':id/editar', loadComponent: () => import('./pages/user-form-page').then(m => m.UserFormPage) },
];
