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
    path: ':id/budgets/new',
    loadComponent: () => import('../budgets/budget-form').then((m) => m.BudgetForm),
  },
  {
    path: ':id/budgets/:budgetId',
    loadComponent: () => import('../budgets/budget-detail').then((m) => m.BudgetDetail),
  },
  {
    path: ':id',
    loadComponent: () => import('./service-order-detail').then((m) => m.ServiceOrderDetail),
  },
];
