import type { Database } from '../../core/supabase/database.types';

export type Product = Database['public']['Tables']['products']['Row'];
export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];
export type ServiceOrderPart = Database['public']['Tables']['service_order_parts']['Row'];

export type MovementType = 'in' | 'out' | 'adjustment';
export type MovementReason =
  | 'initial_stock'
  | 'purchase'
  | 'sale'
  | 'service_order'
  | 'service_return'
  | 'damaged'
  | 'internal_use'
  | 'adjustment'
  | 'other';

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in: 'Entrada',
  out: 'Salida',
  adjustment: 'Ajuste',
};

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  initial_stock: 'Inventario inicial',
  purchase: 'Compra / Ingreso',
  sale: 'Venta mostrador',
  service_order: 'Orden de servicio',
  service_return: 'Devolución de orden',
  damaged: 'Producto dañado / Merma',
  internal_use: 'Uso interno',
  adjustment: 'Ajuste de inventario',
  other: 'Otro motivo',
};

export const INVENTORY_CATEGORIES = [
  'Componentes',
  'Laptop',
  'PC de Escritorio',
  'Celular & Tablet',
  'Periféricos',
  'Insumos de Taller',
  'Repuestos',
  'Almacenamiento',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export function movementReasonLabel(reason: string): string {
  return MOVEMENT_REASON_LABELS[reason as MovementReason] ?? reason;
}

export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type as MovementType] ?? type;
}

export function calculateProfit(costPrice: number, salePrice: number): number {
  return Number((salePrice - costPrice).toFixed(2));
}

export function calculateMargin(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0;
  const profit = salePrice - costPrice;
  return Number(((profit / costPrice) * 100).toFixed(1));
}

export interface ProductSummaryKpis {
  totalActiveSkus: number;
  totalUnitsInStock: number;
  criticalStockCount: number;
  outOfStockCount: number;
  totalValuation: number;
}

export interface CreateProductDto {
  name: string;
  category: string;
  cost_price: number;
  sale_price: number;
  initial_stock: number;
  min_stock: number;
  brand?: string | null;
  model?: string | null;
  sku?: string | null;
  barcode?: string | null;
  compatibility?: string | null;
  location?: string | null;
  supplier?: string | null;
  notes?: string | null;
}

export interface UpdateProductDto {
  name: string;
  category: string;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  compatibility?: string | null;
  location?: string | null;
  supplier?: string | null;
  notes?: string | null;
  active?: boolean;
}

export interface AdjustStockDto {
  productId: string;
  quantity: number; // Positive for entry, negative for exit
  reason: MovementReason;
  referenceDoc?: string | null;
  notes?: string | null;
}

export interface ServiceOrderPartWithProduct extends ServiceOrderPart {
  product: Pick<Product, 'id' | 'name' | 'sku' | 'category' | 'current_stock' | 'location'> | null;
}
