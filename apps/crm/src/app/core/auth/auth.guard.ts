import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from '../supabase/supabase.client';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await supabase.auth.getSession();
  return data.session !== null ? true : router.parseUrl('/login');
};
