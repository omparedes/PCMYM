import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { form, min, required } from '@angular/forms/signals';
import { InventoryService } from '../inventory.service';
import {
  INVENTORY_CATEGORIES,
  calculateMargin,
  calculateProfit,
  generateProductSku,
  movementReasonLabel,
} from '../inventory.models';
import type { Product, InventoryMovement } from '../inventory.models';

export type ProductDrawerMode = 'create' | 'edit' | 'detail';

interface ProductFormModel {
  name: string;
  category: string;
  brand: string;
  model: string;
  sku: string;
  barcode: string;
  compatibility: string;
  location: string;
  supplier: string;
  cost_price: number | null;
  sale_price: number | null;
  initial_stock: number;
  min_stock: number;
  notes: string;
}

type SuggestionField = 'name' | 'brand' | 'model';

interface ProductSuggestion {
  field: SuggestionField;
  value: string;
  label: string;
  detail: string;
  product: Product | null;
}

function emptyProductForm(): ProductFormModel {
  return {
    name: '',
    category: 'Componentes',
    brand: '',
    model: '',
    sku: '',
    barcode: '',
    compatibility: '',
    location: '',
    supplier: '',
    cost_price: 0,
    sale_price: 0,
    initial_stock: 1,
    min_stock: 1,
    notes: '',
  };
}

function normalizeSuggestionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-product-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './product-drawer.html',
})
export class ProductDrawerComponent {
  private readonly inventoryService = inject(InventoryService);

  readonly isOpen = input.required<boolean>();
  readonly mode = input<ProductDrawerMode>('create');
  readonly product = input<Product | null>(null);

  readonly closeDrawer = output<void>();
  readonly productSaved = output<Product>();
  readonly openAdjustment = output<{ product: Product; type: 'in' | 'out' }>();

  protected readonly categories = INVENTORY_CATEGORIES;
  protected readonly movementReasonLabel = movementReasonLabel;

  protected readonly formModel = signal<ProductFormModel>(emptyProductForm());
  protected readonly productForm = form(this.formModel, (path) => {
    required(path.name, { message: 'El nombre del producto es obligatorio' });
    required(path.category, { message: 'La categoría es obligatoria' });
    required(path.cost_price, { message: 'El costo es obligatorio' });
    min(path.cost_price, 0, { message: 'El costo no puede ser negativo' });
    required(path.sale_price, { message: 'El precio de venta es obligatorio' });
    min(path.sale_price, 0, { message: 'El precio no puede ser negativo' });
  });

  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly activeSuggestionField = signal<SuggestionField | null>(null);
  protected readonly skuManuallyEdited = signal(false);

  // A lightweight tenant-scoped catalog is loaded when the drawer opens. It powers
  // keyboard-friendly suggestions without adding a new table or exposing other tenants.
  protected readonly catalogProducts = resource({
    params: () => ({ isOpen: this.isOpen(), mode: this.mode() }),
    loader: async ({ params }) => {
      if (!params.isOpen || params.mode === 'detail') return [];
      return this.inventoryService.listProducts({ activeOnly: true });
    },
    defaultValue: [] as Product[],
  });

  protected readonly generatedSku = computed(() => {
    const value = this.formModel();
    return generateProductSku(
      {
        name: value.name,
        category: value.category,
        brand: value.brand,
        model: value.model,
      },
      this.catalogProducts.value().map((product) => product.sku).filter((sku): sku is string => !!sku),
    );
  });

  protected readonly suggestionItems = computed<ProductSuggestion[]>(() => {
    const field = this.activeSuggestionField();
    if (!field) return [];

    const value = String(this.formModel()[field] ?? '').trim();
    const term = normalizeSuggestionText(value);
    if (!term) return [];

    const products = this.catalogProducts.value();
    const seen = new Set<string>();
    const suggestions: ProductSuggestion[] = [];

    for (const product of products) {
      if (field === 'name') {
        const searchText = normalizeSuggestionText(
          [product.name, product.brand, product.model, product.category].filter(Boolean).join(' '),
        );
        if (!searchText.includes(term)) continue;
        const key = `${product.name}|${product.brand ?? ''}|${product.model ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          field,
          value: product.name,
          label: product.name,
          detail: [product.brand, product.model, product.category].filter(Boolean).join(' · '),
          product,
        });
      } else {
        const candidate = field === 'brand' ? product.brand : product.model;
        if (!candidate || !normalizeSuggestionText(candidate).includes(term)) continue;
        const key = candidate.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          field,
          value: candidate,
          label: candidate,
          detail: [product.name, product.brand, product.model].filter(Boolean).join(' · '),
          product: field === 'model' ? product : null,
        });
      }
    }

    return suggestions
      .sort((a, b) => {
        const aStarts = normalizeSuggestionText(a.label).startsWith(term) ? 0 : 1;
        const bStarts = normalizeSuggestionText(b.label).startsWith(term) ? 0 : 1;
        return aStarts - bStarts || a.label.localeCompare(b.label);
      })
      .slice(0, 8);
  });

  // Live profit and margin calculation
  protected readonly liveProfit = computed(() => {
    const cost = this.formModel().cost_price ?? 0;
    const sale = this.formModel().sale_price ?? 0;
    return calculateProfit(cost, sale);
  });

  protected readonly liveMargin = computed(() => {
    const cost = this.formModel().cost_price ?? 0;
    const sale = this.formModel().sale_price ?? 0;
    return calculateMargin(cost, sale);
  });

  // Movements resource for detail mode
  protected readonly movements = resource({
    params: () => ({
      productId: this.product()?.id ?? null,
      mode: this.mode(),
      isOpen: this.isOpen(),
    }),
    loader: async ({ params }) => {
      if (!params.productId || params.mode !== 'detail' || !params.isOpen) return [];
      return this.inventoryService.getProductMovements(params.productId, 5);
    },
    defaultValue: [] as InventoryMovement[],
  });

  constructor() {
    effect(() => {
      const p = this.product();
      const currentMode = this.mode();
      if (p && (currentMode === 'edit' || currentMode === 'detail')) {
        this.formModel.set({
          name: p.name,
          category: p.category,
          brand: p.brand ?? '',
          model: p.model ?? '',
          sku: p.sku ?? '',
          barcode: p.barcode ?? '',
          compatibility: p.compatibility ?? '',
          location: p.location ?? '',
          supplier: p.supplier ?? '',
          cost_price: Number(p.cost_price),
          sale_price: Number(p.sale_price),
          initial_stock: p.current_stock,
          min_stock: p.min_stock,
          notes: p.notes ?? '',
        });
      } else {
        this.formModel.set(emptyProductForm());
        this.skuManuallyEdited.set(false);
      }
      this.errorMessage.set(null);
      this.activeSuggestionField.set(null);
    });
  }

  protected onClose(): void {
    this.closeDrawer.emit();
  }

  protected onFieldInput(field: keyof ProductFormModel, value: string | number | null): void {
    this.formModel.update((prev) => ({ ...prev, [field]: value }));
    if (field === 'sku') this.skuManuallyEdited.set(true);
  }

  protected onSuggestionFocus(field: SuggestionField): void {
    this.activeSuggestionField.set(field);
  }

  protected onSuggestionBlur(): void {
    this.activeSuggestionField.set(null);
  }

  protected chooseSuggestion(event: MouseEvent, suggestion: ProductSuggestion): void {
    event.preventDefault();
    if (suggestion.product && suggestion.field === 'name') {
      const product = suggestion.product;
      this.formModel.update((previous) => ({
        ...previous,
        name: product.name,
        category: product.category,
        brand: product.brand ?? '',
        model: product.model ?? '',
        compatibility: product.compatibility ?? '',
        supplier: product.supplier ?? '',
        notes: product.notes ?? '',
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        sku: this.skuManuallyEdited() ? previous.sku : '',
      }));
    } else if (suggestion.product && suggestion.field === 'model') {
      const product = suggestion.product;
      this.formModel.update((previous) => ({
        ...previous,
        category: product.category,
        brand: previous.brand || product.brand || '',
        model: suggestion.value,
        compatibility: product.compatibility ?? previous.compatibility,
        supplier: product.supplier ?? previous.supplier,
        notes: product.notes ?? previous.notes,
        cost_price: Number(product.cost_price),
        sale_price: Number(product.sale_price),
        sku: this.skuManuallyEdited() ? previous.sku : '',
      }));
    } else {
      this.formModel.update((previous) => ({ ...previous, [suggestion.field]: suggestion.value }));
    }
    this.activeSuggestionField.set(null);
  }

  protected toggleSkuEdit(): void {
    if (this.skuManuallyEdited()) {
      this.skuManuallyEdited.set(false);
      return;
    }
    this.formModel.update((previous) => ({ ...previous, sku: this.generatedSku() }));
    this.skuManuallyEdited.set(true);
  }

  protected async onSubmit(): Promise<void> {
    if (!this.productForm().valid()) return;
    this.errorMessage.set(null);
    this.isSaving.set(true);

    try {
      const val = this.formModel();
      let savedProduct: Product;

      if (this.mode() === 'create') {
        savedProduct = await this.inventoryService.createProduct({
          name: val.name,
          category: val.category,
          cost_price: Number(val.cost_price ?? 0),
          sale_price: Number(val.sale_price ?? 0),
          initial_stock: Number(val.initial_stock ?? 0),
          min_stock: Number(val.min_stock ?? 0),
          brand: val.brand || null,
          model: val.model || null,
          sku: this.skuManuallyEdited() && val.sku.trim() ? val.sku.trim() : this.generatedSku(),
          barcode: val.barcode || null,
          compatibility: val.compatibility || null,
          location: val.location || null,
          supplier: val.supplier || null,
          notes: val.notes || null,
        });
      } else {
        const prodId = this.product()!.id;
        savedProduct = await this.inventoryService.updateProduct(prodId, {
          name: val.name,
          category: val.category,
          cost_price: Number(val.cost_price ?? 0),
          sale_price: Number(val.sale_price ?? 0),
          min_stock: Number(val.min_stock ?? 0),
          brand: val.brand || null,
          model: val.model || null,
          barcode: val.barcode || null,
          compatibility: val.compatibility || null,
          location: val.location || null,
          supplier: val.supplier || null,
          notes: val.notes || null,
        });
      }

      this.productSaved.emit(savedProduct);
      this.onClose();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onQuickStock(type: 'in' | 'out'): void {
    const p = this.product();
    if (p) {
      this.openAdjustment.emit({ product: p, type });
    }
  }
}
