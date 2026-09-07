import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BudgetsService } from './budgets.service';
import { budgetStatusLabel, lineTotal, nextValidBudgetStatuses } from './budgets.models';
import type { BudgetItemType, BudgetStatus, NewBudgetItem } from './budgets.models';
import { InventoryService } from '../inventory/inventory.service';
import type { Product } from '../inventory/inventory.models';

@Component({
  selector: 'app-budget-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './budget-detail.html',
})
export class BudgetDetail {
  private readonly service = inject(BudgetsService);
  private readonly inventory = inject(InventoryService);
  private readonly route = inject(ActivatedRoute);

  protected readonly serviceOrderId = this.route.snapshot.paramMap.get('id')!;
  protected readonly budgetId = this.route.snapshot.paramMap.get('budgetId')!;

  protected readonly budgetStatusLabel = budgetStatusLabel;
  protected readonly lineTotal = lineTotal;

  protected readonly budget = resource({
    params: () => ({ id: this.budgetId }),
    loader: ({ params }) => this.service.get(params.id),
  });

  protected readonly items = resource({
    params: () => ({ id: this.budgetId }),
    loader: ({ params }) => this.service.listItems(params.id),
    defaultValue: [],
  });

  protected readonly history = resource({
    params: () => ({ id: this.budgetId }),
    loader: ({ params }) => this.service.history(params.id),
    defaultValue: [],
  });

  protected readonly products = resource({
    params: () => ({ id: this.budgetId }),
    loader: () => this.inventory.listProducts({ activeOnly: true }),
    defaultValue: [] as Product[],
  });
  protected readonly hasLinkedParts = computed(() =>
    this.items.value().some((item) => item.item_type === 'part' && item.product_id),
  );

  protected readonly nextStatuses = () => nextValidBudgetStatuses(this.budget.value()?.status ?? '');
  protected readonly changingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);

  protected async changeStatus(newStatus: BudgetStatus): Promise<void> {
    this.statusError.set(null);
    this.changingStatus.set(true);
    try {
      await this.service.changeStatus(this.budgetId, newStatus);
      this.budget.reload();
      this.history.reload();
    } catch (err) {
      this.statusError.set(err instanceof Error ? err.message : 'Error al cambiar el estado');
    } finally {
      this.changingStatus.set(false);
    }
  }

  protected readonly newItemDescription = signal('');
  protected readonly newItemQuantity = signal(1);
  protected readonly newItemUnitPrice = signal(0);
  protected readonly addingItem = signal(false);
  protected readonly itemError = signal<string | null>(null);
  protected readonly newItemType = signal<BudgetItemType>('other');
  protected readonly newItemProductId = signal<string | null>(null);
  protected readonly selectedProduct = computed(() =>
    this.products.value().find((product) => product.id === this.newItemProductId()) ?? null,
  );
  protected readonly applyingParts = signal(false);
  protected readonly applyError = signal<string | null>(null);
  protected readonly applyResult = signal<{ products_applied: number; units_reserved: number; units_returned: number } | null>(null);

  protected setNewItemType(type: BudgetItemType): void {
    this.newItemType.set(type);
    if (type !== 'part') this.newItemProductId.set(null);
  }

  protected selectNewProduct(productId: string): void {
    const product = this.products.value().find((item) => item.id === productId);
    this.newItemProductId.set(product?.id ?? null);
    if (product) {
      this.newItemDescription.set(product.name);
      this.newItemUnitPrice.set(Number(product.sale_price));
      this.newItemType.set('part');
    }
  }

  protected async addItem(): Promise<void> {
    this.itemError.set(null);
    const description = this.newItemDescription().trim();
    if (!description) {
      this.itemError.set('La descripción es obligatoria');
      return;
    }
    if (this.newItemType() === 'part' && !this.newItemProductId()) {
      this.itemError.set('Selecciona un producto del inventario para el repuesto');
      return;
    }
    if (this.newItemType() === 'part' && !Number.isInteger(this.newItemQuantity())) {
      this.itemError.set('La cantidad de un repuesto debe ser un número entero');
      return;
    }

    const item: NewBudgetItem = {
      description,
      quantity: this.newItemQuantity() > 0 ? this.newItemQuantity() : 1,
      unit_price: this.newItemUnitPrice() >= 0 ? this.newItemUnitPrice() : 0,
      item_type: this.newItemType(),
      product_id: this.newItemProductId(),
    };

    this.addingItem.set(true);
    try {
      await this.service.addItem(this.budgetId, item);
      this.newItemDescription.set('');
      this.newItemQuantity.set(1);
      this.newItemUnitPrice.set(0);
      this.newItemType.set('other');
      this.newItemProductId.set(null);
      this.items.reload();
      this.budget.reload();
    } catch (err) {
      this.itemError.set(err instanceof Error ? err.message : 'Error al agregar el ítem');
    } finally {
      this.addingItem.set(false);
    }
  }

  protected async applyParts(): Promise<void> {
    this.applyError.set(null);
    this.applyResult.set(null);
    this.applyingParts.set(true);
    try {
      const result = await this.service.applyPartsToServiceOrder(this.budgetId);
      this.applyResult.set(result);
    } catch (err) {
      this.applyError.set(err instanceof Error ? err.message : 'No se pudieron aplicar los repuestos');
    } finally {
      this.applyingParts.set(false);
    }
  }

  protected async removeItem(itemId: string): Promise<void> {
    this.itemError.set(null);
    try {
      await this.service.removeItem(itemId);
      this.items.reload();
      this.budget.reload();
    } catch (err) {
      this.itemError.set(err instanceof Error ? err.message : 'Error al eliminar el ítem');
    }
  }
}
