import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { FinancialEntry } from './finance.models';

// Read-only by design: financial_entries has no INSERT grant for
// `authenticated` (see migration) — it is only ever written by the
// SECURITY DEFINER trigger on payments, so there is no write method here.
@Injectable({ providedIn: 'root' })
export class FinanceService {
  async listEntries(): Promise<FinancialEntry[]> {
    const { data, error } = await supabase
      .from('financial_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
