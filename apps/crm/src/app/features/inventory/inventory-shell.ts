import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from './inventory.service';
import { InventorySummaryComponent } from './components/inventory-summary';
import { ProductListComponent } from './components/product-list';
import { InventoryMovementsComponent } from './components/inventory-movements';
import { LowStockListComponent } from './components/low-stock-list';
import { ProductDrawerComponent, type ProductDrawerMode } from './components/product-drawer';
import { StockAdjustmentModalComponent } from './components/stock-adjustment-modal';
import type { Product } from './inventory.models';

export type InventorySubTab = 'summary' | 'products' | 'movements' | 'low_stock';

@Component({
  selector: 'app-inventory-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    InventorySummaryComponent,
    ProductListComponent,
    InventoryMovementsComponent,
    LowStockListComponent,
    ProductDrawerComponent,
    StockAdjustmentModalComponent,
  ],
  templateUrl: './inventory-shell.html',
})
export class InventoryShell {
  private readonly inventoryService = inject(InventoryService);

  protected readonly summaryComp = viewChild(InventorySummaryComponent);
  protected readonly listComp = viewChild(ProductListComponent);
  protected readonly movementsComp = viewChild(InventoryMovementsComponent);
  protected readonly lowStockComp = viewChild(LowStockListComponent);

  protected readonly activeTab = signal<InventorySubTab>('summary');

  // Drawer state
  protected readonly isDrawerOpen = signal(false);
  protected readonly drawerMode = signal<ProductDrawerMode>('create');
  protected readonly selectedDrawerProduct = signal<Product | null>(null);

  // Modal state
  protected readonly isModalOpen = signal(false);
  protected readonly selectedModalProduct = signal<Product | null>(null);
  protected readonly modalInitialType = signal<'in' | 'out'>('in');

  // Header alert badge
  protected readonly kpis = resource({
    loader: () => this.inventoryService.getSummaryKpis(),
  });

  protected readonly lowStockCount = computed(() => {
    const data = this.kpis.value();
    if (!data) return 0;
    return data.criticalStockCount + data.outOfStockCount;
  });

  protected setTab(tab: InventorySubTab): void {
    this.activeTab.set(tab);
  }

  // Drawer actions
  protected openCreateProduct(): void {
    this.drawerMode.set('create');
    this.selectedDrawerProduct.set(null);
    this.isDrawerOpen.set(true);
  }

  protected openEditProduct(product: Product): void {
    this.drawerMode.set('edit');
    this.selectedDrawerProduct.set(product);
    this.isDrawerOpen.set(true);
  }

  protected openDetailProduct(product: Product): void {
    this.drawerMode.set('detail');
    this.selectedDrawerProduct.set(product);
    this.isDrawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  // Modal actions
  protected openStockAdjustment(event: { product: Product; type: 'in' | 'out' }): void {
    this.selectedModalProduct.set(event.product);
    this.modalInitialType.set(event.type);
    this.isModalOpen.set(true);
  }

  protected openQuickAdjustment(): void {
    this.selectedModalProduct.set(null);
    this.modalInitialType.set('in');
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  // Refresh handlers
  protected onProductSaved(): void {
    this.refreshAll();
  }

  protected onStockAdjusted(): void {
    this.refreshAll();
  }

  private refreshAll(): void {
    this.kpis.reload();
    this.summaryComp()?.reload();
    this.listComp()?.reload();
    this.movementsComp()?.reload();
    this.lowStockComp()?.reload();
  }
}
