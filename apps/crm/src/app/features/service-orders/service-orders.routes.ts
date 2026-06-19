import { Routes } from '@angular/router';

export const serviceOrdersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./service-orders-board').then((m) => m.ServiceOrdersBoard),
  },
  {
    path: 'new',
    loadComponent: () => import('./service-order-form').then((m) => m.ServiceOrderForm),
  },
  {
    path: ':id',
    loadComponent: () => import('./service-order-detail').then((m) => m.ServiceOrderDetail),
  },
];
