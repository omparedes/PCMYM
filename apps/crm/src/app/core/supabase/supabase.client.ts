import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from './database.types';

// Cliente Supabase único para toda la app. Usa solo la anon key pública;
// la autorización real la imponen las políticas RLS en Postgres.
// Tipado con el esquema real (database.types.ts, autogenerado).
export const supabase = createClient<Database>(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
);
