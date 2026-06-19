import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase.client';
import type { Database } from '../supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

// RLS already scopes this to the caller's own business; no manual filtering needed.
@Injectable({ providedIn: 'root' })
export class ProfilesService {
  async list(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (error) throw error;
    return data;
  }
}
