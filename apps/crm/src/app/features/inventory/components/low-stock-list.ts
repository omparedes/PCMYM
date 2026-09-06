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
import type { Product } from '../inventory.models';

@Component({
  selector: 'app-low-stock-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './low-stock-list.html',
})
export class LowStockListComponent {
  private readonly inventoryService = inject(InventoryService);

  public readonly openAdjust = output<Product>();
  public readonly openDetail = output<Product>();

  protected readonly filterStatus = signal<'all_low' | 'out_only'>('all_low');

  protected readonly products = resource({
    params: () => ({ status: this.filterStatus() }),
    loader: async ({ params }) => {
      const all = await this.inventoryService.listProducts({
        stockStatus: params.status === 'out_only' ? 'out' : 'low',
      });
      // If all_low, also include out of stock
      if (params.status === 'all_low') {
        const out = await this.inventoryService.listProducts({ stockStatus: 'out' });
        const ids = new Set(all.map((p) => p.id));
        for (const p of out) {
          if (!ids.has(p.id)) all.push(p);
        }
      }
      return all.sort((a, b) => a.current_stock - b.current_stock);
    },
    defaultValue: [],
  });

  protected readonly outOfStockCount = computed(
    () => this.products.value().filter((p) => p.current_stock === 0).length,
  );

  protected readonly lowStockCount = computed(
    () => this.products.value().filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock).length,
  );

  protected readonly estimatedRestockCost = computed(() =>
    this.products.value().reduce((acc, p) => {
      const needed = Math.max(0, p.min_stock - p.current_stock);
      return acc + needed * Number(p.cost_price || 0);
    }, 0),
  );

  protected setFilter(status: 'all_low' | 'out_only'): void {
    this.filterStatus.set(status);
  }

  public reload(): void {
    this.products.reload();
  }
}
