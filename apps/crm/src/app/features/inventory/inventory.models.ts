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

export interface ProductSkuInput {
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
}

/**
 * Builds the same human-readable SKU shape used by the initial inventory load.
 * The database repeats this logic and is the final authority for uniqueness.
 */
export function generateProductSku(input: ProductSkuInput, existingSkus: string[] = []): string {
  const text = `${input.name} ${input.category} ${input.model ?? ''}`.toLowerCase();
  const family = text.includes('mouse') || text.includes('ratón')
    ? 'MOU'
    : text.includes('teclado')
      ? 'KBD'
      : text.includes('parlante') || text.includes('speaker')
        ? 'SPK'
        : text.includes('estabilizador')
          ? 'EST'
          : text.includes('wifi') || text.includes('wi-fi')
            ? 'WIFI'
            : text.includes('bluetooth')
              ? 'BT'
              : text.includes('case') || text.includes('hdd') || text.includes('ssd')
                ? 'CASE'
                : text.includes('cable')
                  ? 'CBL'
                  : text.includes('monitor')
                    ? 'MON'
                    : 'PRD';

  const brand = skuToken(input.brand, 'GEN', 3);
  const model = skuModelToken(input.model) || skuToken(input.name, 'ITEM', 10);
  const variant = skuVariantToken(`${input.name} ${input.model ?? ''}`);
  const base = ['PCMYM', family, brand, model, variant].filter(Boolean).join('-');
  const used = new Set(existingSkus.map((sku) => sku.toUpperCase()));

  if (!used.has(base.toUpperCase())) return base;

  let suffix = 2;
  while (used.has(`${base}-${String(suffix).padStart(2, '0')}`.toUpperCase())) suffix += 1;
  return `${base}-${String(suffix).padStart(2, '0')}`;
}

function skuToken(value: string | null | undefined, fallback: string, maxLength: number): string {
  const token = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, maxLength);
  return token || fallback;
}

function skuModelToken(value: string | null | undefined): string {
  const tokens = (value ?? '').toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const digitIndex = tokens.findIndex((token) => /\d/.test(token));
  if (digitIndex > 0 && /^\d+$/.test(tokens[digitIndex])) {
    return skuToken(`${tokens[digitIndex - 1]}${tokens[digitIndex]}`, '', 12);
  }
  return skuToken(tokens[digitIndex] ?? tokens[0], '', 12);
}

function skuVariantToken(value: string): string {
  const normalized = value.toLowerCase();
  const variants: [RegExp, string][] = [
    [/\b(blanco|white)\b/, 'WHT'],
    [/\b(negro|black)\b/, 'BLK'],
    [/\b(rojo|red)\b/, 'RED'],
    [/\b(celeste|azul|blue)\b/, 'BLU'],
    [/\b(gris|gray|grey)\b/, 'GRY'],
    [/\b(verde|green)\b/, 'GRN'],
  ];
  return variants.find(([pattern]) => pattern.test(normalized))?.[1] ?? '';
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
