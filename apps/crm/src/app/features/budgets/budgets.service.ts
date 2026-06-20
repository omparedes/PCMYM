import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { Budget, BudgetItem, BudgetStatus, BudgetStatusHistoryEntry, NewBudgetItem } from './budgets.models';

// business_id is enforced by RLS on read/update; on insert the client must
// supply it explicitly, resolved via the auth_business_id() RPC (same
// pattern as ServiceOrdersService/PaymentsService).
@Injectable({ providedIn: 'root' })
export class BudgetsService {
  async listByServiceOrder(serviceOrderId: string): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('service_order_id', serviceOrderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async get(id: string): Promise<Budget> {
    const { data, error } = await supabase.from('budgets').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async listItems(budgetId: string): Promise<BudgetItem[]> {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async history(budgetId: string): Promise<BudgetStatusHistoryEntry[]> {
    const { data, error } = await supabase
      .from('budget_status_history')
      .select('*')
      .eq('budget_id', budgetId)
      .order('changed_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async create(serviceOrderId: string, notes: string | null): Promise<Budget> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        business_id: businessId,
        service_order_id: serviceOrderId,
        notes,
        created_by: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async addItem(budgetId: string, item: NewBudgetItem): Promise<BudgetItem> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        business_id: businessId,
        budget_id: budgetId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('budget_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  async changeStatus(id: string, newStatus: BudgetStatus): Promise<Budget> {
    const { data, error } = await supabase.rpc('change_budget_status', {
      p_budget_id: id,
      p_new_status: newStatus,
    });
    if (error) throw error;
    return data;
  }
}
