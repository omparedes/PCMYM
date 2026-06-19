import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'customers',
    canActivate: [authGuard],
    loadChildren: () => import('./features/customers/customers.routes').then((m) => m.customersRoutes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'customers' },
  { path: '**', redirectTo: 'customers' },
];
