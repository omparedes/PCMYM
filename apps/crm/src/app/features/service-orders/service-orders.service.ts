import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type {
  NewServiceOrder,
  OrderStatusHistoryEntry,
  ServiceOrder,
  ServiceOrderWithCustomer,
} from './service-orders.models';

// business_id is enforced by RLS on read/update; on insert the client must
// supply it explicitly, resolved via the auth_business_id() RPC (same
// pattern as CustomersService).
@Injectable({ providedIn: 'root' })
export class ServiceOrdersService {
  async listActive(): Promise<ServiceOrderWithCustomer[]> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, customer:customers(id, name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as unknown as ServiceOrderWithCustomer[];
  }

  async get(id: string): Promise<ServiceOrderWithCustomer> {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, customer:customers(id, name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as unknown as ServiceOrderWithCustomer;
  }

  async history(serviceOrderId: string): Promise<OrderStatusHistoryEntry[]> {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('service_order_id', serviceOrderId)
      .order('changed_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async create(input: NewServiceOrder): Promise<ServiceOrder> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data, error } = await supabase
      .from('service_orders')
      .insert({ ...input, business_id: businessId })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async changeStatus(id: string, newStatus: string, note: string | null): Promise<ServiceOrder> {
    const { data, error } = await supabase.rpc('change_service_order_status', {
      p_service_order_id: id,
      p_new_status: newStatus,
      p_note: note ?? undefined,
    });
    if (error) throw error;
    return data;
  }
}
