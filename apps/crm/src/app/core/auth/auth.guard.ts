import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Placeholder de Fase 1: redirige a /login si no hay sesión. RLS sigue siendo
// la barrera de seguridad real; este guard solo mejora la UX de navegación.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.parseUrl('/login');
};
