import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'service-orders',
        loadChildren: () =>
          import('./features/service-orders/service-orders.routes').then((m) => m.serviceOrdersRoutes),
      },
      {
        path: 'customers',
        loadChildren: () => import('./features/customers/customers.routes').then((m) => m.customersRoutes),
      },
      {
        path: 'finance',
        loadChildren: () => import('./features/finance/finance.routes').then((m) => m.financeRoutes),
      },
      { path: '', pathMatch: 'full', redirectTo: 'service-orders' },
    ],
  },
  { path: '**', redirectTo: 'service-orders' },
];
