import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { TrackingService } from './tracking.service';
import { ORDERED_STATUSES, statusLabel } from '../service-orders/service-orders.models';
import type { ServiceOrderStatus } from '../service-orders/service-orders.models';
import { budgetStatusLabel } from '../budgets/budgets.models';

@Component({
  selector: 'app-tracking-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './tracking-status.html',
})
export class TrackingStatus {
  private readonly service = inject(TrackingService);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = this.route.snapshot.paramMap.get('token')!;

  protected readonly statusLabel = statusLabel;
  protected readonly budgetStatusLabel = budgetStatusLabel;

  // Linear progress steps for the timeline; `cancelled` is shown separately
  // as a terminal banner instead of a step (it can interrupt any of these).
  protected readonly steps: ServiceOrderStatus[] = ORDERED_STATUSES.filter(
    (status) => status !== 'cancelled',
  );

  protected readonly info = resource({
    params: () => ({ token: this.token }),
    loader: ({ params }) => this.service.getByToken(params.token),
  });

  private readonly currentStepIndex = computed(() => {
    const status = this.info.value()?.status;
    return status ? this.steps.indexOf(status as ServiceOrderStatus) : -1;
  });

  protected readonly isCancelled = computed(() => this.info.value()?.status === 'cancelled');

  protected stepState(step: ServiceOrderStatus): 'done' | 'current' | 'upcoming' {
    const current = this.currentStepIndex();
    if (current === -1) return 'upcoming';
    const idx = this.steps.indexOf(step);
    if (idx < current) return 'done';
    if (idx === current) return 'current';
    return 'upcoming';
  }

  protected readonly budgetMessage = computed(() => {
    const budget = this.info.value()?.budget;
    if (!budget) return null;
    if (budget.status === 'approved') return `Tu presupuesto #${budget.folio} fue aprobado.`;
    if (budget.status === 'rejected') return `Tu presupuesto #${budget.folio} fue rechazado.`;
    return `Te enviamos el presupuesto #${budget.folio}, pendiente de tu respuesta.`;
  });
}
