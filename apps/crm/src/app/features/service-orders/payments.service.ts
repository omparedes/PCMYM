import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { Payment, PaymentMethod } from './service-orders.models';

export interface NewPayment {
  amount: number;
  payment_method: PaymentMethod;
}

// financial_entries books itself automatically from this insert (trigger,
// see migration) — the client never writes to financial_entries directly.
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  async list(serviceOrderId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('service_order_id', serviceOrderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async create(serviceOrderId: string, input: NewPayment): Promise<Payment> {
    const { data: businessId, error: rpcError } = await supabase.rpc('auth_business_id');
    if (rpcError) throw rpcError;

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        service_order_id: serviceOrderId,
        amount: input.amount,
        payment_method: input.payment_method,
        recorded_by: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
}
