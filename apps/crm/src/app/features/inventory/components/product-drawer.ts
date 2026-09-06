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
    initial_stock: 0,
    min_stock: 3,
    notes: '',
  };
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
      }
      this.errorMessage.set(null);
    });
  }

  protected onClose(): void {
    this.closeDrawer.emit();
  }

  protected onFieldInput(field: keyof ProductFormModel, value: string | number | null): void {
    this.formModel.update((prev) => ({ ...prev, [field]: value }));
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
          sku: val.sku || null,
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
