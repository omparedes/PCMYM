import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  resource,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { InventoryService } from '../inventory.service';
import type { Product, ProductSummaryKpis } from '../inventory.models';

@Component({
  selector: 'app-inventory-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './inventory-summary.html',
})
export class InventorySummaryComponent {
  private readonly inventoryService = inject(InventoryService);

  readonly openDetail = output<Product>();
  readonly openAdjustment = output<{ product: Product; type: 'in' | 'out' }>();
  readonly goToProducts = output<void>();
  readonly goToStockBajo = output<void>();

  // Fetch KPIs
  protected readonly kpis = resource({
    loader: async () => this.inventoryService.getSummaryKpis(),
    defaultValue: {
      totalActiveSkus: 0,
      totalUnitsInStock: 0,
      criticalStockCount: 0,
      outOfStockCount: 0,
      totalValuation: 0,
    } as ProductSummaryKpis,
  });

  // Fetch critical items
  protected readonly attentionProducts = resource({
    loader: async () => {
      const all = await this.inventoryService.listProducts({ activeOnly: true });
      return all.filter((p) => p.current_stock <= p.min_stock);
    },
    defaultValue: [] as Product[],
  });

  public reload(): void {
    this.kpis.reload();
    this.attentionProducts.reload();
  }
}
