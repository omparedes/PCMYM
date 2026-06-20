import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { FinanceService } from './finance.service';
import { entryTypeLabel } from './finance.models';

@Component({
  selector: 'app-finance-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './finance-dashboard.html',
})
export class FinanceDashboard {
  private readonly service = inject(FinanceService);

  protected readonly entryTypeLabel = entryTypeLabel;

  protected readonly entries = resource({
    loader: () => this.service.listEntries(),
    defaultValue: [],
  });

  protected readonly totalBalance = computed(() =>
    this.entries.value().reduce(
      (balance, entry) => balance + (entry.entry_type === 'income' ? Number(entry.amount) : -Number(entry.amount)),
      0,
    ),
  );

  protected readonly currentMonthIncome = computed(() =>
    this.entries
      .value()
      .filter((e) => e.entry_type === 'income' && this.isCurrentMonth(e.created_at))
      .reduce((sum, e) => sum + Number(e.amount), 0),
  );

  protected readonly currentMonthExpense = computed(() =>
    this.entries
      .value()
      .filter((e) => e.entry_type === 'expense' && this.isCurrentMonth(e.created_at))
      .reduce((sum, e) => sum + Number(e.amount), 0),
  );

  private isCurrentMonth(isoDate: string): boolean {
    const now = new Date();
    const d = new Date(isoDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  protected readonly monthly = resource({
    loader: () => this.service.incomeExpenseMonthly(),
    defaultValue: [],
  });

  // Last 6 months, oldest first, for the income-vs-expense bar chart.
  protected readonly monthlyChart = computed(() => {
    const rows = this.monthly.value().slice(-6);
    const maxValue = Math.max(1, ...rows.map((r) => Math.max(Number(r.total_income) || 0, Number(r.total_expense) || 0)));
    return rows.map((r) => ({
      label: new Date(r.entry_month!).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
      income: Number(r.total_income) || 0,
      expense: Number(r.total_expense) || 0,
      incomePct: ((Number(r.total_income) || 0) / maxValue) * 100,
      expensePct: ((Number(r.total_expense) || 0) / maxValue) * 100,
    }));
  });

  protected readonly topCustomers = resource({
    loader: () => this.service.topCustomers(5),
    defaultValue: [],
  });

  protected readonly topEquipmentTypes = resource({
    loader: () => this.service.topEquipmentTypes(5),
    defaultValue: [],
  });

  protected readonly accountsReceivable = resource({
    loader: () => this.service.accountsReceivable(),
    defaultValue: [],
  });

  protected readonly totalReceivable = computed(() =>
    this.accountsReceivable.value().reduce((sum, r) => sum + Number(r.balance_due ?? 0), 0),
  );

  protected readonly showExpenseForm = signal(false);
  protected readonly expenseAmount = signal<number | null>(null);
  protected readonly expenseDescription = signal('');
  protected readonly savingExpense = signal(false);
  protected readonly expenseError = signal<string | null>(null);

  protected toggleExpenseForm(): void {
    this.showExpenseForm.set(!this.showExpenseForm());
    this.expenseAmount.set(null);
    this.expenseDescription.set('');
    this.expenseError.set(null);
  }

  protected async submitExpense(): Promise<void> {
    this.expenseError.set(null);
    const amount = this.expenseAmount();
    const description = this.expenseDescription().trim();

    if (!amount || amount <= 0) {
      this.expenseError.set('El monto debe ser mayor a 0');
      return;
    }
    if (!description) {
      this.expenseError.set('La descripción es obligatoria');
      return;
    }

    this.savingExpense.set(true);
    try {
      await this.service.recordExpense(amount, description);
      this.expenseAmount.set(null);
      this.expenseDescription.set('');
      this.showExpenseForm.set(false);
      this.entries.reload();
      this.monthly.reload();
    } catch (err) {
      this.expenseError.set(err instanceof Error ? err.message : 'Error al registrar el gasto');
    } finally {
      this.savingExpense.set(false);
    }
  }
}
