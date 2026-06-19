import { Routes } from '@angular/router';

// Fase 0: solo el login placeholder. Las rutas de dominio (clientes, ordenes,
// finanzas) se añaden en Fase 1, normalmente con carga diferida (loadComponent).
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
