import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { InventoryService } from '../../inventory/inventory.service';
import { OrderPartsService } from '../order-parts.service';
import type { Product } from '../../inventory/inventory.models';

@Component({
  selector: 'app-add-order-part-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './add-order-part-modal.html',
})
export class AddOrderPartModalComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly orderPartsService = inject(OrderPartsService);

  readonly isOpen = input.required<boolean>();
  readonly orderId = input.required<string>();
  readonly orderFolio = input<number | string>('');

  readonly closeModal = output<void>();
  readonly partAdded = output<void>();

  protected readonly searchTerm = signal('');
  protected readonly selectedProduct = signal<Product | null>(null);
  protected readonly quantity = signal<number>(1);
  protected readonly notes = signal<string>('');

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly products = resource({
    params: () => ({ search: this.searchTerm() }),
    loader: async ({ params }) => {
      return this.inventoryService.listProducts({
        search: params.search,
        activeOnly: true,
      });
    },
    defaultValue: [] as Product[],
  });

  protected readonly isStockInsufficient = computed(() => {
    const prod = this.selectedProduct();
    if (!prod) return false;
    return this.quantity() > prod.current_stock || prod.current_stock <= 0;
  });

  protected readonly projectedStock = computed(() => {
    const prod = this.selectedProduct();
    if (!prod) return 0;
    return Math.max(0, prod.current_stock - this.quantity());
  });

  protected readonly subtotal = computed(() => {
    const prod = this.selectedProduct();
    if (!prod) return 0;
    return this.quantity() * Number(prod.sale_price || 0);
  });

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected selectProduct(product: Product): void {
    if (product.current_stock <= 0) return;
    this.selectedProduct.set(product);
    this.quantity.set(1);
    this.errorMessage.set(null);
  }

  protected incrementQty(): void {
    const prod = this.selectedProduct();
    if (!prod) return;
    if (this.quantity() < prod.current_stock) {
      this.quantity.update((q) => q + 1);
    }
  }

  protected decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  protected onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLInputElement).value);
  }

  protected async submitAddPart(): Promise<void> {
    const prod = this.selectedProduct();
    if (!prod) {
      this.errorMessage.set('Por favor, selecciona un repuesto del catálogo.');
      return;
    }

    if (this.isStockInsufficient()) {
      this.errorMessage.set(`Stock insuficiente. Solo hay ${prod.current_stock} unidad(es) disponible(s).`);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.orderPartsService.addPartToOrder(
        this.orderId(),
        prod.id,
        this.quantity(),
        this.notes().trim() || undefined,
      );

      // Reset state
      this.selectedProduct.set(null);
      this.quantity.set(1);
      this.notes.set('');
      this.searchTerm.set('');

      this.partAdded.emit();
      this.closeModal.emit();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al asignar repuesto a la orden');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected handleClose(): void {
    this.selectedProduct.set(null);
    this.quantity.set(1);
    this.notes.set('');
    this.errorMessage.set(null);
    this.closeModal.emit();
  }
}
