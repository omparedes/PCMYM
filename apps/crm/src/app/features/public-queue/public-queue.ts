import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicQueueService } from './public-queue.service';

@Component({
  selector: 'app-public-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './public-queue.html',
})
export class PublicQueue implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PublicQueueService);

  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly refreshTrigger = signal(0);
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly queue = resource({
    params: () => ({ token: this.token, trigger: this.refreshTrigger() }),
    loader: ({ params }) => this.service.getPublicQueue(params.token),
  });

  protected readonly isEnabled = computed(() => this.queue.value()?.is_enabled ?? false);
  protected readonly counts = computed(() => this.queue.value()?.counts);
  protected readonly activeItems = computed(() => this.queue.value()?.active_items ?? []);
  protected readonly waitingItems = computed(() => this.queue.value()?.waiting_items ?? []);
  protected readonly waitBand = computed(() => this.queue.value()?.estimated_wait_band);

  protected readonly isQueueEmpty = computed(() => {
    const c = this.counts();
    return !c || (c.in_service === 0 && c.waiting === 0);
  });

  ngOnInit(): void {
    // Poll every 60 seconds only while tab is visible (Resource API)
    this.timerId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.refreshTrigger.update((n) => n + 1);
      }
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  protected refreshManually(): void {
    this.refreshTrigger.update((n) => n + 1);
  }
}
