import { Routes } from '@angular/router';

export const proformasRoutes: Routes = [
  {
    path: ':id/edit',
    loadComponent: () => import('./proformas-shell').then((m) => m.ProformasShell),
  },
  {
    path: ':id/print',
    loadComponent: () => import('./proforma-print').then((m) => m.ProformaPrint),
  },
  {
    path: '',
    loadComponent: () => import('./proformas-shell').then((m) => m.ProformasShell),
  },
];
