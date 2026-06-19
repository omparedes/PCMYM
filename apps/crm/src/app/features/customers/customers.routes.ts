import { Routes } from '@angular/router';

export const customersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./customers-list').then((m) => m.CustomersList),
  },
  {
    path: 'new',
    loadComponent: () => import('./customer-form').then((m) => m.CustomerForm),
  },
  {
    path: ':id',
    loadComponent: () => import('./customer-form').then((m) => m.CustomerForm),
  },
];
