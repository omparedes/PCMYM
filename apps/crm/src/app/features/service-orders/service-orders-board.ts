import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServiceOrdersService } from './service-orders.service';
import {
  ORDERED_STATUSES,
  WORK_TYPE_OPTIONS,
  priorityLabel,
  statusLabel,
  workTypeLabel,
  type ServiceOrderWithCustomer,
  type ServiceOrderWorkType,
} from './service-orders.models';

type ViewMode = 'kanban' | 'tabs' | 'list';

@Component({
  selector: 'app-service-orders-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './service-orders-board.html',
})
export class ServiceOrdersBoard {
  private readonly service = inject(ServiceOrdersService);
  private readonly today = new Date();

  protected readonly statusLabel = statusLabel;
  protected readonly priorityLabel = priorityLabel;
  protected readonly workTypeLabel = workTypeLabel;
  protected readonly statuses = ORDERED_STATUSES;
  protected readonly workTypeOptions = WORK_TYPE_OPTIONS;
  protected readonly viewMode = signal<ViewMode>((localStorage.getItem('pcmym_view_mode') as ViewMode) || 'tabs');
  protected readonly collapsedColumns = signal<Record<string, boolean>>(JSON.parse(localStorage.getItem('pcmym_collapsed_cols') || '{"delivered":true,"cancelled":true}'));
  protected readonly activeTab = signal(localStorage.getItem('pcmym_active_tab') || 'pending');
  protected readonly selectedWorkType = signal<ServiceOrderWorkType | null>(null);
  protected readonly attentionOnly = signal(false);

  protected readonly orders = resource({ loader: () => this.service.listActive(), defaultValue: [] as ServiceOrderWithCustomer[] });
  protected readonly activeCount = computed(() => this.orders.value().filter((order) => !['delivered', 'cancelled'].includes(order.status)).length);

  constructor() {
    effect(() => localStorage.setItem('pcmym_view_mode', this.viewMode()));
    effect(() => localStorage.setItem('pcmym_collapsed_cols', JSON.stringify(this.collapsedColumns())));
    effect(() => localStorage.setItem('pcmym_active_tab', this.activeTab()));
  }

  protected toggleColumn(status: string): void {
    this.collapsedColumns.update((columns) => ({ ...columns, [status]: !columns[status] }));
  }

  protected setWorkTypeFilter(type: ServiceOrderWorkType | null): void {
    this.selectedWorkType.set(this.selectedWorkType() === type ? null : type);
  }

  protected readonly filteredOrders = computed(() => this.orders.value().filter((order) => {
    const workType = this.selectedWorkType();
    if (workType && !this.workTypes(order).includes(workType)) return false;
    return !this.attentionOnly() || this.needsAttention(order);
  }));

  protected readonly columns = computed(() => {
    const grouped = new Map<string, ServiceOrderWithCustomer[]>();
    for (const status of this.statuses) grouped.set(status, []);
    for (const order of this.filteredOrders()) grouped.get(order.status)?.push(order);
    for (const orders of grouped.values()) orders.sort((a, b) => this.sortOrders(a, b));
    return grouped;
  });

  protected workTypes(order: ServiceOrderWithCustomer): ServiceOrderWorkType[] {
    return (order.work_types ?? []).filter((type): type is ServiceOrderWorkType => WORK_TYPE_OPTIONS.includes(type as ServiceOrderWorkType));
  }

  protected receivedLabel(order: ServiceOrderWithCustomer): string {
    const days = this.daysSince(order.received_at);
    return days === 0 ? 'Recibida hoy' : `Recibida hace ${days} día${days === 1 ? '' : 's'}`;
  }

  protected deliveryLabel(order: ServiceOrderWithCustomer): string {
    if (!order.estimated_delivery) return 'Sin fecha de entrega';
    const days = this.daysUntil(order.estimated_delivery);
    if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
    if (days === 0) return 'Entrega hoy';
    if (days === 1) return 'Entrega mañana';
    return `Entrega en ${days} días`;
  }

  protected isDeliveryCritical(order: ServiceOrderWithCustomer): boolean {
    return order.estimated_delivery !== null && this.daysUntil(order.estimated_delivery) <= 0 && !['delivered', 'cancelled'].includes(order.status);
  }

  protected isReadyToClose(order: ServiceOrderWithCustomer): boolean {
    return order.status === 'ready' && this.daysSince(order.updated_at) >= 3;
  }

  protected needsAttention(order: ServiceOrderWithCustomer): boolean {
    return order.priority === 'urgent' || this.isDeliveryCritical(order) || this.isReadyToClose(order);
  }

  private sortOrders(a: ServiceOrderWithCustomer, b: ServiceOrderWithCustomer): number {
    const priority = (value: string) => value === 'urgent' ? 0 : value === 'high' ? 1 : value === 'normal' ? 2 : 3;
    const byPriority = priority(a.priority) - priority(b.priority);
    if (byPriority !== 0) return byPriority;
    const byDelivery = this.deliverySortValue(a) - this.deliverySortValue(b);
    if (byDelivery !== 0) return byDelivery;
    return new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
  }

  private deliverySortValue(order: ServiceOrderWithCustomer): number {
    return order.estimated_delivery ? new Date(`${order.estimated_delivery}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
  }

  private daysSince(value: string): number {
    return Math.max(0, Math.floor((this.startOfToday().getTime() - new Date(value).getTime()) / 86_400_000));
  }

  private daysUntil(value: string): number {
    return Math.round((new Date(`${value}T00:00:00`).getTime() - this.startOfToday().getTime()) / 86_400_000);
  }

  private startOfToday(): Date {
    return new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
  }
}
