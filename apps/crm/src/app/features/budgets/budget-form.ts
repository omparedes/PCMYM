import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { BudgetsService } from './budgets.service';
import type { NewBudgetItem } from './budgets.models';

interface DraftItem {
  description: string;
  quantity: number;
  unit_price: number;
}

function emptyDraftItem(): DraftItem {
  return { description: '', quantity: 1, unit_price: 0 };
}

@Component({
  selector: 'app-budget-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './budget-form.html',
})
export class BudgetForm {
  private readonly service = inject(BudgetsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly serviceOrderId = this.route.snapshot.paramMap.get('id')!;

  protected readonly notes = signal('');
  protected readonly items = signal<DraftItem[]>([emptyDraftItem()]);

  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
  );

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected addRow(): void {
    this.items.update((rows) => [...rows, emptyDraftItem()]);
  }

  protected removeRow(index: number): void {
    this.items.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected updateRow(index: number, field: keyof DraftItem, value: string): void {
    this.items.update((rows) =>
      rows.map((row, i) =>
        i === index
          ? { ...row, [field]: field === 'description' ? value : Number(value) }
          : row,
      ),
    );
  }

  protected async onSubmit(): Promise<void> {
    this.errorMsg.set(null);

    const validItems: NewBudgetItem[] = this.items()
      .filter((row) => row.description.trim().length > 0)
      .map((row) => ({
        description: row.description.trim(),
        quantity: row.quantity > 0 ? row.quantity : 1,
        unit_price: row.unit_price >= 0 ? row.unit_price : 0,
      }));

    if (validItems.length === 0) {
      this.errorMsg.set('Agrega al menos un ítem con descripción');
      return;
    }

    this.saving.set(true);
    try {
      const budget = await this.service.create(this.serviceOrderId, this.notes().trim() || null);
      for (const item of validItems) {
        await this.service.addItem(budget.id, item);
      }
      await this.router.navigate(['/service-orders', this.serviceOrderId, 'budgets', budget.id]);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al crear el presupuesto');
    } finally {
      this.saving.set(false);
    }
  }
}
