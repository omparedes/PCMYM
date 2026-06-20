import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BudgetsService } from './budgets.service';
import { budgetStatusLabel, lineTotal, nextValidBudgetStatuses } from './budgets.models';
import type { BudgetStatus, NewBudgetItem } from './budgets.models';

@Component({
  selector: 'app-budget-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './budget-detail.html',
})
export class BudgetDetail {
  private readonly service = inject(BudgetsService);
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

  protected async addItem(): Promise<void> {
    this.itemError.set(null);
    const description = this.newItemDescription().trim();
    if (!description) {
      this.itemError.set('La descripción es obligatoria');
      return;
    }

    const item: NewBudgetItem = {
      description,
      quantity: this.newItemQuantity() > 0 ? this.newItemQuantity() : 1,
      unit_price: this.newItemUnitPrice() >= 0 ? this.newItemUnitPrice() : 0,
    };

    this.addingItem.set(true);
    try {
      await this.service.addItem(this.budgetId, item);
      this.newItemDescription.set('');
      this.newItemQuantity.set(1);
      this.newItemUnitPrice.set(0);
      this.items.reload();
      this.budget.reload();
    } catch (err) {
      this.itemError.set(err instanceof Error ? err.message : 'Error al agregar el ítem');
    } finally {
      this.addingItem.set(false);
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
