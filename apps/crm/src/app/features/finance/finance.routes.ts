import { Routes } from '@angular/router';

export const financeRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./finance-dashboard').then((m) => m.FinanceDashboard),
  },
];
