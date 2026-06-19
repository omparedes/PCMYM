import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ServiceOrdersService } from './service-orders.service';
import { nextValidStatuses, priorityLabel, statusLabel } from './service-orders.models';

@Component({
  selector: 'app-service-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './service-order-detail.html',
})
export class ServiceOrderDetail {
  private readonly service = inject(ServiceOrdersService);
  private readonly route = inject(ActivatedRoute);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;

  protected readonly statusLabel = statusLabel;
  protected readonly priorityLabel = priorityLabel;

  protected readonly order = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.service.get(params.id),
  });

  protected readonly history = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.service.history(params.id),
    defaultValue: [],
  });

  protected readonly nextStatuses = () => nextValidStatuses(this.order.value()?.status ?? '');

  protected readonly selectedNextStatus = signal('');
  protected readonly note = signal('');
  protected readonly changingStatus = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected onSelectStatus(event: Event): void {
    this.selectedNextStatus.set((event.target as HTMLSelectElement).value);
  }

  protected onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submitStatusChange(): Promise<void> {
    if (!this.selectedNextStatus()) return;
    this.errorMsg.set(null);
    this.changingStatus.set(true);
    try {
      await this.service.changeStatus(this.orderId, this.selectedNextStatus(), this.note().trim() || null);
      this.selectedNextStatus.set('');
      this.note.set('');
      this.order.reload();
      this.history.reload();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al cambiar el estado');
    } finally {
      this.changingStatus.set(false);
    }
  }
}
