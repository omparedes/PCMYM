import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { BudgetItem, Budget } from '../budgets/budgets.models';
import type { Customer } from '../customers/customers.models';
import type { Payment, ServiceOrderWithCustomer, ServiceOrderDelivery } from './service-orders.models';
import type { ServiceOrderPartWithProduct } from '../inventory/inventory.models';
import type { Business, BudgetWithItems, ServiceOrderDocumentData } from './service-order-documents.models';

@Injectable({ providedIn: 'root' })
export class ServiceOrderDocumentsService {
  async getData(orderId: string): Promise<ServiceOrderDocumentData> {
    const { data: orderData, error: orderError } = await supabase
      .from('service_orders')
      .select('*, customer:customers(id, name)')
      .eq('id', orderId)
      .single();
    if (orderError) throw orderError;

    const order = orderData as unknown as ServiceOrderWithCustomer;
    const [customerResult, businessResult, partsResult, budgetsResult, paymentsResult, deliveryResult] = await Promise.all([
      supabase.from('customers').select('*').eq('id', order.customer_id).single(),
      supabase.from('businesses').select('*').eq('id', order.business_id).single(),
      supabase
        .from('service_order_parts')
        .select('*, product:products(id, name, sku, category, current_stock, location)')
        .eq('service_order_id', orderId)
        .order('created_at', { ascending: true }),
      supabase.from('budgets').select('*').eq('service_order_id', orderId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('service_order_id', orderId).order('created_at', { ascending: true }),
      supabase.from('service_order_deliveries').select('*').eq('service_order_id', orderId).maybeSingle(),
    ]);

    if (customerResult.error) throw customerResult.error;
    if (businessResult.error) throw businessResult.error;
    if (partsResult.error) throw partsResult.error;
    if (budgetsResult.error) throw budgetsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (deliveryResult.error) throw deliveryResult.error;

    const budgets = (budgetsResult.data as Budget[]) ?? [];
    const budgetIds = budgets.map((budget) => budget.id);
    let budgetItems: BudgetItem[] = [];
    if (budgetIds.length > 0) {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .in('budget_id', budgetIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      budgetItems = data ?? [];
    }

    const budgetsWithItems: BudgetWithItems[] = budgets.map((budget) => ({
      ...budget,
      items: budgetItems.filter((item) => item.budget_id === budget.id),
    }));

    return {
      order,
      customer: customerResult.data as Customer,
      business: businessResult.data as Business,
      parts: (partsResult.data as unknown as ServiceOrderPartWithProduct[]) ?? [],
      budgets: budgetsWithItems,
      payments: (paymentsResult.data as Payment[]) ?? [],
      delivery: deliveryResult.data as ServiceOrderDelivery | null,
    };
  }
}
