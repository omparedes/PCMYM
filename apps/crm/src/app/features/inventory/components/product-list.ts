import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  resource,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { InventoryService } from '../inventory.service';
import { INVENTORY_CATEGORIES } from '../inventory.models';
import type { Product } from '../inventory.models';

@Component({
  selector: 'app-product-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './product-list.html',
})
export class ProductListComponent {
  private readonly inventoryService = inject(InventoryService);

  readonly openDetail = output<Product>();
  readonly openEdit = output<Product>();
  readonly openAdjustment = output<{ product: Product; type: 'in' | 'out' }>();

  protected readonly categories = ['Todas', ...INVENTORY_CATEGORIES];

  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('Todas');
  protected readonly selectedStockStatus = signal<'all' | 'low' | 'out'>('all');
  protected readonly onlyAttention = signal(false);

  // Resource to fetch products reactively
  protected readonly products = resource({
    params: () => ({
      search: this.searchTerm(),
      category: this.selectedCategory(),
      stockStatus: this.onlyAttention() ? 'low' : this.selectedStockStatus(),
    }),
    loader: async ({ params }) => {
      return this.inventoryService.listProducts({
        search: params.search,
        category: params.category,
        stockStatus: params.stockStatus,
      });
    },
    defaultValue: [] as Product[],
  });

  protected readonly filteredProducts = computed(() => {
    const list = this.products.value();
    if (this.onlyAttention()) {
      return list.filter((p) => p.current_stock <= p.min_stock);
    }
    return list;
  });

  protected onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
  }

  protected selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  protected selectStockStatus(status: 'all' | 'low' | 'out'): void {
    this.selectedStockStatus.set(status);
    this.onlyAttention.set(false);
  }

  protected toggleAttention(): void {
    this.onlyAttention.set(!this.onlyAttention());
  }

  protected onRowClick(product: Product): void {
    this.openDetail.emit(product);
  }

  protected onQuickStock(event: Event, product: Product, type: 'in' | 'out'): void {
    event.stopPropagation();
    this.openAdjustment.emit({ product, type });
  }

  protected onEditClick(event: Event, product: Product): void {
    event.stopPropagation();
    this.openEdit.emit(product);
  }

  public reload(): void {
    this.products.reload();
  }
}
