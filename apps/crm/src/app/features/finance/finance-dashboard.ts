import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
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
}
