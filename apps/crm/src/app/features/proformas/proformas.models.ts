import type { Database } from '../../core/supabase/database.types';

export type SupplierCatalogImport = Database['public']['Tables']['supplier_catalog_imports']['Row'];
export type SupplierProduct = Database['public']['Tables']['supplier_products']['Row'];
export type SalesQuote = Database['public']['Tables']['sales_quotes']['Row'];
export type SalesQuoteItem = Database['public']['Tables']['sales_quote_items']['Row'];

export type SalesQuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
export type SupplierProductType = 'component' | 'laptop' | 'desktop' | 'monitor' | 'peripheral' | 'other';
export type SupplierCatalogGroup = 'pc_parts' | 'laptops' | 'monitors' | 'peripherals' | 'other';
export type SupplierComponentCategory = 'processor' | 'motherboard' | 'memory' | 'storage' | 'graphics' | 'power_supply' | 'case' | 'cooling' | 'other';
export type CompatibilityStatus = 'unchecked' | 'compatible' | 'incompatible' | 'review';

export interface ParsedSupplierProduct {
  supplier_code: string;
  supplier_mini_code: string | null;
  category: string;
  name: string;
  technical_description: string | null;
  stock_text: string | null;
  stock_quantity: number | null;
  stock_is_at_least: boolean;
  distribution_price_usd: number | null;
  pge_price_usd: number | null;
  freight_text: string | null;
  igv_exempt: boolean;
  warranty_code: string | null;
  brand: string | null;
  technical_comment: string | null;
  source_url: string | null;
}

export interface DeltronParseResult {
  products: ParsedSupplierProduct[];
  exchange_rate: number;
  tax_included: boolean;
  source_date: string | null;
  skipped_rows: number;
  warnings: string[];
}

export interface SalesQuoteItemDraft {
  build_key?: string | null;
  specification_snapshot?: SupplierProduct['technical_attributes'];
  supplier_product_id: string;
  description: string;
  quantity: number;
  unit_cost_usd: number;
  unit_cost_pen: number;
  unit_price_pen: number;
  compatibility_status: CompatibilityStatus;
  compatibility_notes: string | null;
}

export interface SalesQuoteEditorData {
  quote: SalesQuote;
  items: SalesQuoteItem[];
  products: SupplierProduct[];
}

export const SUPPLIER_PRODUCT_TYPE_LABELS: Record<SupplierProductType, string> = {
  component: 'Componente',
  laptop: 'Laptop',
  desktop: 'Computadora',
  monitor: 'Monitor',
  peripheral: 'Periférico',
  other: 'Otros',
};

export const SUPPLIER_CATALOG_GROUP_LABELS: Record<SupplierCatalogGroup, string> = {
  pc_parts: 'Partes PC',
  laptops: 'Laptops',
  monitors: 'Monitores',
  peripherals: 'Periféricos',
  other: 'Otros',
};

export const SUPPLIER_COMPONENT_CATEGORY_LABELS: Record<SupplierComponentCategory, string> = {
  processor: 'Procesadores',
  motherboard: 'Placas madre',
  memory: 'Memorias RAM',
  storage: 'Almacenamiento',
  graphics: 'Tarjetas de video',
  power_supply: 'Fuentes',
  case: 'Cases',
  cooling: 'Refrigeración',
  other: 'Otros componentes',
};

export const SUPPLIER_SEARCH_SUGGESTIONS = [
  { label: 'Memoria RAM', value: 'ram' },
  { label: 'Placa madre', value: 'placa madre' },
  { label: 'Procesador', value: 'procesador' },
  { label: 'Almacenamiento SSD', value: 'ssd' },
  { label: 'Tarjeta de video', value: 'tarjeta de video' },
  { label: 'Fuente de poder', value: 'fuente de poder' },
  { label: 'Case / gabinete', value: 'case' },
  { label: 'Laptop', value: 'laptop' },
  { label: 'Monitor', value: 'monitor' },
];

export const SALES_QUOTE_STATUS_LABELS: Record<SalesQuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
};

export function supplierProductTypeLabel(type: string): string {
  return SUPPLIER_PRODUCT_TYPE_LABELS[type as SupplierProductType] ?? 'Otros';
}

export function supplierCatalogGroupLabel(group: string): string {
  return SUPPLIER_CATALOG_GROUP_LABELS[group as SupplierCatalogGroup] ?? 'Otros';
}

export function supplierComponentCategoryLabel(category: string): string {
  return SUPPLIER_COMPONENT_CATEGORY_LABELS[category as SupplierComponentCategory] ?? 'Otros componentes';
}

export function salesQuoteStatusLabel(status: string): string {
  return SALES_QUOTE_STATUS_LABELS[status as SalesQuoteStatus] ?? status;
}

export function roundQuotePrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value);
}

export function quoteItemTotal(item: Pick<SalesQuoteItem | SalesQuoteItemDraft, 'quantity' | 'unit_price_pen'>): number {
  return Number((Number(item.quantity) * Number(item.unit_price_pen)).toFixed(2));
}

export function productSearchText(product: Pick<SupplierProduct, 'name' | 'brand' | 'category' | 'supplier_code'>): string {
  return product.name + ' ' + (product.brand ?? '') + ' ' + product.category + ' ' + product.supplier_code;
}
