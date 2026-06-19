import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Cliente Supabase único para toda la app. Usa solo la anon key pública;
// la autorización real la imponen las políticas RLS en Postgres.
export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
);
