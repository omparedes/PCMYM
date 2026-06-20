import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type {
  AccountReceivable,
  FinancialEntry,
  IncomeExpenseMonthly,
  TopCustomer,
  TopEquipmentType,
} from './finance.models';

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

  // The only write path for an expense — financial_entries has no INSERT
  // grant for `authenticated` (see migration); record_expense() is a
  // SECURITY DEFINER RPC that stamps business_id itself.
  async recordExpense(amount: number, description: string): Promise<FinancialEntry> {
    const { data, error } = await supabase.rpc('record_expense', {
      p_amount: amount,
      p_description: description,
    });
    if (error) throw error;
    return data;
  }

  async incomeExpenseMonthly(): Promise<IncomeExpenseMonthly[]> {
    const { data, error } = await supabase
      .from('v_income_expense_monthly')
      .select('*')
      .order('entry_month', { ascending: true });
    if (error) throw error;
    return data;
  }

  async topCustomers(limit = 5): Promise<TopCustomer[]> {
    const { data, error } = await supabase
      .from('v_top_customers')
      .select('*')
      .order('total_revenue', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async topEquipmentTypes(limit = 5): Promise<TopEquipmentType[]> {
    const { data, error } = await supabase
      .from('v_top_equipment_types')
      .select('*')
      .order('order_count', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async accountsReceivable(): Promise<AccountReceivable[]> {
    const { data, error } = await supabase
      .from('v_accounts_receivable')
      .select('*')
      .order('balance_due', { ascending: false });
    if (error) throw error;
    return data;
  }
}
