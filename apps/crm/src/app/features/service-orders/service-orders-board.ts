import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServiceOrdersService } from './service-orders.service';
import {
  ORDERED_STATUSES,
  priorityLabel,
  statusLabel,
  type ServiceOrderWithCustomer,
} from './service-orders.models';

@Component({
  selector: 'app-service-orders-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './service-orders-board.html',
})
export class ServiceOrdersBoard {
  private readonly service = inject(ServiceOrdersService);

  protected readonly statusLabel = statusLabel;
  protected readonly priorityLabel = priorityLabel;
  protected readonly statuses = ORDERED_STATUSES;

  protected readonly viewMode = signal<'kanban' | 'tabs' | 'list'>(
    (localStorage.getItem('pcmym_view_mode') as 'kanban' | 'tabs' | 'list') || 'tabs'
  );
  
  protected readonly collapsedColumns = signal<Record<string, boolean>>(
    JSON.parse(localStorage.getItem('pcmym_collapsed_cols') || '{"delivered":true,"cancelled":true}')
  );
  
  protected readonly activeTab = signal<string>(
    localStorage.getItem('pcmym_active_tab') || 'pending'
  );

  constructor() {
    effect(() => {
      localStorage.setItem('pcmym_view_mode', this.viewMode());
    });
    effect(() => {
      localStorage.setItem('pcmym_collapsed_cols', JSON.stringify(this.collapsedColumns()));
    });
    effect(() => {
      localStorage.setItem('pcmym_active_tab', this.activeTab());
    });
  }

  protected toggleColumn(status: string) {
    this.collapsedColumns.update((cols) => ({
      ...cols,
      [status]: !cols[status],
    }));
  }

  protected readonly orders = resource({
    loader: () => this.service.listActive(),
    defaultValue: [] as ServiceOrderWithCustomer[],
  });

  protected readonly columns = computed(() => {
    const grouped = new Map<string, ServiceOrderWithCustomer[]>();
    for (const status of this.statuses) grouped.set(status, []);
    for (const order of this.orders.value()) {
      grouped.get(order.status)?.push(order);
    }
    return grouped;
  });
}
