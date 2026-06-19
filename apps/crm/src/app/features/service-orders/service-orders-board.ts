import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
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
