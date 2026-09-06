import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type {
  AdjustStockDto,
  CreateProductDto,
  InventoryMovement,
  Product,
  ProductSummaryKpis,
  UpdateProductDto,
} from './inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  async listProducts(filters?: {
    search?: string;
    category?: string;
    stockStatus?: 'all' | 'low' | 'out';
    activeOnly?: boolean;
  }): Promise<Product[]> {
    let query = supabase.from('products').select('*').order('name', { ascending: true });

    if (filters?.activeOnly !== false) {
      query = query.eq('active', true);
    }

    if (filters?.category && filters.category !== 'Todas' && filters.category !== 'Todos') {
      query = query.eq('category', filters.category);
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(
        `name.ilike.${term},sku.ilike.${term},brand.ilike.${term},model.ilike.${term},barcode.ilike.${term}`,
      );
    }

    if (filters?.stockStatus === 'out') {
      query = query.eq('current_stock', 0);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = data ?? [];

    if (filters?.stockStatus === 'low') {
      results = results.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock);
    }

    return results;
  }

  async getProduct(id: string): Promise<Product> {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getProductMovements(productId: string, limit = 10): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listAllMovements(filters?: {
    type?: string;
    search?: string;
    limit?: number;
  }): Promise<(InventoryMovement & { product?: Pick<Product, 'name' | 'sku' | 'category'> | null })[]> {
    let query = supabase
      .from('inventory_movements')
      .select('*, product:products(name, sku, category)')
      .order('created_at', { ascending: false });

    if (filters?.type && filters.type !== 'all') {
      query = query.eq('movement_type', filters.type);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as unknown as (InventoryMovement & { product?: Pick<Product, 'name' | 'sku' | 'category'> | null })[]) ?? [];
  }

  async getSummaryKpis(): Promise<ProductSummaryKpis> {
    const { data, error } = await supabase.from('products').select('*').eq('active', true);
    if (error) throw new Error(error.message);

    const products = data ?? [];
    let totalUnits = 0;
    let criticalCount = 0;
    let outCount = 0;
    let totalVal = 0;

    for (const p of products) {
      totalUnits += p.current_stock;
      totalVal += p.current_stock * Number(p.cost_price);

      if (p.current_stock === 0) {
        outCount++;
      } else if (p.current_stock <= p.min_stock) {
        criticalCount++;
      }
    }

    return {
      totalActiveSkus: products.length,
      totalUnitsInStock: totalUnits,
      criticalStockCount: criticalCount,
      outOfStockCount: outCount,
      totalValuation: Number(totalVal.toFixed(2)),
    };
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const { data, error } = await supabase.rpc('create_product_with_initial_stock', {
      p_name: dto.name,
      p_category: dto.category,
      p_cost_price: dto.cost_price,
      p_sale_price: dto.sale_price,
      p_initial_stock: dto.initial_stock,
      p_min_stock: dto.min_stock,
      p_brand: dto.brand ?? undefined,
      p_model: dto.model ?? undefined,
      p_sku: dto.sku ?? undefined,
      p_barcode: dto.barcode ?? undefined,
      p_compatibility: dto.compatibility ?? undefined,
      p_location: dto.location ?? undefined,
      p_supplier: dto.supplier ?? undefined,
      p_notes: dto.notes ?? undefined,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    // Current stock is deliberately NOT updated here to ensure full auditability.
    const { data, error } = await supabase
      .from('products')
      .update({
        name: dto.name,
        category: dto.category,
        brand: dto.brand ?? null,
        model: dto.model ?? null,
        barcode: dto.barcode ?? null,
        compatibility: dto.compatibility ?? null,
        location: dto.location ?? null,
        supplier: dto.supplier ?? null,
        cost_price: dto.cost_price,
        sale_price: dto.sale_price,
        min_stock: dto.min_stock,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async adjustStock(dto: AdjustStockDto): Promise<Product> {
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      p_product_id: dto.productId,
      p_quantity: dto.quantity,
      p_reason: dto.reason,
      p_reference_doc: dto.referenceDoc ?? undefined,
      p_notes: dto.notes ?? undefined,
    });

    if (error) throw new Error(error.message);
    return data;
  }

  async toggleProductActive(id: string, currentActive: boolean): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update({ active: !currentActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
