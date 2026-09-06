import { Routes } from '@angular/router';

export const inventoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./inventory-shell').then((m) => m.InventoryShell),
  },
];
