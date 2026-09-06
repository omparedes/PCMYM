import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { ServiceOrderPart, ServiceOrderPartWithProduct } from '../inventory/inventory.models';

@Injectable({ providedIn: 'root' })
export class OrderPartsService {
  async listPartsByOrder(orderId: string): Promise<ServiceOrderPartWithProduct[]> {
    const { data, error } = await supabase
      .from('service_order_parts')
      .select('*, product:products(id, name, sku, category, current_stock, location)')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data as unknown as ServiceOrderPartWithProduct[]) ?? [];
  }

  async addPartToOrder(
    orderId: string,
    productId: string,
    quantity: number,
    notes?: string,
  ): Promise<ServiceOrderPart> {
    const { data, error } = await supabase.rpc('add_part_to_service_order', {
      p_service_order_id: orderId,
      p_product_id: productId,
      p_quantity: quantity,
      p_notes: notes ?? undefined,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async modifyPartQuantity(
    orderId: string,
    productId: string,
    newQuantity: number,
  ): Promise<ServiceOrderPart> {
    const { data, error } = await supabase.rpc('modify_service_order_part_qty', {
      p_service_order_id: orderId,
      p_product_id: productId,
      p_new_quantity: newQuantity,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async removePartFromOrder(orderId: string, productId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('remove_part_from_service_order', {
      p_service_order_id: orderId,
      p_product_id: productId,
    });

    if (error) throw new Error(error.message);
    return data;
  }
}
