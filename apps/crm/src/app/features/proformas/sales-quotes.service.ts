import { Injectable, inject } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type { SalesQuote, SalesQuoteEditorData, SalesQuoteItem, SalesQuoteItemDraft, SalesQuoteStatus } from './proformas.models';
import { SupplierCatalogService } from './supplier-catalog.service';
import type { Json } from '../../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class SalesQuotesService {
  private readonly catalog = inject(SupplierCatalogService);
  async list(): Promise<SalesQuote[]> {
    const { data, error } = await supabase
      .from('sales_quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async get(id: string): Promise<SalesQuote> {
    const { data, error } = await supabase.from('sales_quotes').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async listItems(quoteId: string): Promise<SalesQuoteItem[]> {
    const { data, error } = await supabase
      .from('sales_quote_items')
      .select('*')
      .eq('sales_quote_id', quoteId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async loadEditor(id: string): Promise<SalesQuoteEditorData> {
    const [quote, items] = await Promise.all([this.get(id), this.listItems(id)]);
    const products = await this.catalog.getProducts(items.map((item) => item.supplier_product_id).filter((id): id is string => !!id));
    return { quote, items, products };
  }

  async create(input: {
    customer_name: string | null;
    customer_phone: string | null;
    exchange_rate: number;
    margin_rate: number;
    tax_rate: number;
    valid_until: string | null;
    notes: string | null;
  }): Promise<SalesQuote> {
    const [{ data: businessId, error: businessError }, { data: userData }] = await Promise.all([
      supabase.rpc('auth_business_id'),
      supabase.auth.getUser(),
    ]);
    if (businessError) throw businessError;
    const { data: folio, error: folioError } = await supabase.rpc('next_sales_quote_folio');
    if (folioError) throw folioError;
    const { data, error } = await supabase
      .from('sales_quotes')
      .insert({
        business_id: businessId,
        folio,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        exchange_rate: input.exchange_rate,
        margin_rate: input.margin_rate,
        tax_rate: input.tax_rate,
        valid_until: input.valid_until,
        notes: input.notes,
        created_by: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async addItem(quoteId: string, item: SalesQuoteItemDraft): Promise<SalesQuoteItem> {
    const { data: businessId, error: businessError } = await supabase.rpc('auth_business_id');
    if (businessError) throw businessError;
    const { data, error } = await supabase
      .from('sales_quote_items')
      .insert({
        business_id: businessId,
        sales_quote_id: quoteId,
        supplier_product_id: item.supplier_product_id,
        description: item.description,
        quantity: item.quantity,
        unit_cost_usd: item.unit_cost_usd,
        unit_cost_pen: item.unit_cost_pen,
        unit_price_pen: item.unit_price_pen,
        compatibility_status: item.compatibility_status,
        compatibility_notes: item.compatibility_notes,
        build_key: item.build_key ?? null,
        specification_snapshot: item.specification_snapshot ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async duplicate(id: string): Promise<SalesQuote> {
    const { data, error } = await supabase.rpc('duplicate_sales_quote', { p_quote_id: id });
    if (error) throw error;
    return data;
  }

  async updateDraft(id: string, input: {
    customer_name: string | null;
    customer_phone: string | null;
    exchange_rate: number;
    margin_rate: number;
    tax_rate: number;
    valid_until: string | null;
    notes: string | null;
    items: SalesQuoteItemDraft[];
  }): Promise<SalesQuote> {
    const { data, error } = await supabase.rpc('update_sales_quote_draft', {
      p_quote_id: id,
      p_customer_name: input.customer_name as unknown as string,
      p_customer_phone: input.customer_phone as unknown as string,
      p_exchange_rate: input.exchange_rate,
      p_margin_rate: input.margin_rate,
      p_tax_rate: input.tax_rate,
      p_valid_until: input.valid_until as unknown as string,
      p_notes: input.notes as unknown as string,
      p_items: input.items as unknown as Json,
    });
    if (error) throw error;
    return data;
  }

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('sales_quote_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  async changeStatus(id: string, status: SalesQuoteStatus): Promise<SalesQuote> {
    const { data, error } = await supabase.from('sales_quotes').update({ status }).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
}
