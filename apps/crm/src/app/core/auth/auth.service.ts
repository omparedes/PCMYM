import { Injectable, computed, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabase.client';

// Servicio de autenticación signal-first sobre Supabase Auth.
// Placeholder de Fase 0: login/logout básicos y sesión reactiva.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    void supabase.auth.getSession().then(({ data }) => this._session.set(data.session));
    supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));
  }

  signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return supabase.auth.signOut();
  }
}
