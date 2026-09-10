import { Injectable } from '@angular/core';
import { supabase } from '../../core/supabase/supabase.client';
import type {
  ParsedSupplierProduct,
  SupplierCatalogGroup,
  SupplierCatalogImport,
  SupplierComponentCategory,
  SupplierProduct,
} from './proformas.models';
import { parseDeltronHtml } from './deltron-html.parser';

export interface SupplierImportResult {
  import: SupplierCatalogImport;
  parsedRows: number;
  acceptedRows: number;
  skippedRows: number;
  warnings: string[];
}

export interface SupplierImportPreview {
  file: File;
  parsed: ReturnType<typeof parseDeltronHtml>;
  sourceHash: string | null;
}

@Injectable({ providedIn: 'root' })
export class SupplierCatalogService {
  async listImports(): Promise<SupplierCatalogImport[]> {
    const { data, error } = await supabase
      .from('supplier_catalog_imports')
      .select('*')
      .eq('status', 'applied')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  }

  async listProducts(options: {
    search?: string;
    quoteOnly?: boolean;
    catalogGroup?: SupplierCatalogGroup | null;
    componentCategory?: SupplierComponentCategory | null;
    includeOutOfStock?: boolean;
  } = {}): Promise<SupplierProduct[]> {
    const products: SupplierProduct[] = [];
    // Exhaust server pages before compatibility/facets: a valid part may be past row 80.
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await supabase.rpc('search_supplier_products', {
      p_search: options.search?.trim() || undefined,
      p_quote_only: options.quoteOnly ?? true,
      p_catalog_group: options.catalogGroup || undefined,
      p_component_category: options.componentCategory || undefined,
      p_include_out_of_stock: options.includeOutOfStock ?? false,
      p_limit: 200,
      p_offset: offset,
    });
    if (error) throw error;
      products.push(...(data ?? []));
      if (!data || data.length < 200) return products;
    }
  }

  async setSpecifications(id: string, overrides: Record<string, string | null>): Promise<SupplierProduct> {
    const { data, error } = await supabase.rpc('set_supplier_specifications', { p_product_id: id, p_overrides: overrides });
    if (error) throw error;
    return data;
  }

  async getProducts(ids: string[]): Promise<SupplierProduct[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from('supplier_products').select('*').in('id', ids);
    if (error) throw error;
    return data;
  }

  async previewDeltronHtml(file: File): Promise<SupplierImportPreview> {
    const html = new TextDecoder('windows-1252').decode(await file.arrayBuffer());
    return { file, parsed: parseDeltronHtml(html), sourceHash: await this.hash(html) };
  }

  async importDeltronHtml(file: File, preview?: SupplierImportPreview): Promise<SupplierImportResult> {
    const html = preview ? null : new TextDecoder('windows-1252').decode(await file.arrayBuffer());
    const parsed = preview?.parsed ?? parseDeltronHtml(html ?? '');
    if (!parsed.products.length) throw new Error('No hay productos válidos para importar');
    const sourceHash = preview?.sourceHash ?? await this.hash(html ?? '');
    const { data: businessId, error: businessError } = await supabase.rpc('auth_business_id');
    if (businessError) throw businessError;
    const { data: userData } = await supabase.auth.getUser();
    const { data: importRow, error: importError } = await supabase
      .from('supplier_catalog_imports')
      .insert({
        business_id: businessId,
        supplier: 'deltron',
        source_file_name: file.name,
        source_hash: sourceHash,
        exchange_rate: parsed.exchange_rate,
        tax_included: parsed.tax_included,
        status: 'preview',
        total_rows: parsed.products.length + parsed.skipped_rows,
        accepted_rows: 0,
        skipped_rows: parsed.skipped_rows,
        error_rows: 0,
        notes: parsed.warnings.join(' | ') || parsed.source_date,
        created_by: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (importError) throw importError;

    const rows = parsed.products.map((product: ParsedSupplierProduct) => ({
      ...product,
      business_id: businessId,
      supplier: 'deltron',
      last_import_id: importRow.id,
      last_seen_at: new Date().toISOString(),
      active: true,
    }));
    let acceptedRows = 0;
    try {
      for (let index = 0; index < rows.length; index += 250) {
        const { error } = await supabase
          .from('supplier_products')
          .upsert(rows.slice(index, index + 250), { onConflict: 'business_id,supplier,supplier_code' });
        if (error) throw error;
        acceptedRows += Math.min(250, rows.length - index);
      }
      const { error: staleError } = await supabase
        .from('supplier_products')
        .update({ active: false })
        .eq('supplier', 'deltron')
        .neq('last_import_id', importRow.id);
      if (staleError) throw staleError;
      const { error: finishError } = await supabase
        .from('supplier_catalog_imports')
        .update({ status: 'applied', accepted_rows: acceptedRows })
        .eq('id', importRow.id);
      if (finishError) throw finishError;
    } catch (error) {
      await supabase.from('supplier_catalog_imports').update({
        status: 'failed',
        accepted_rows: acceptedRows,
        error_rows: rows.length - acceptedRows,
      }).eq('id', importRow.id);
      throw error;
    }

    return {
      import: { ...importRow, status: 'applied', accepted_rows: acceptedRows },
      parsedRows: parsed.products.length,
      acceptedRows,
      skippedRows: parsed.skipped_rows,
      warnings: parsed.warnings,
    };
  }

  private async hash(value: string): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
