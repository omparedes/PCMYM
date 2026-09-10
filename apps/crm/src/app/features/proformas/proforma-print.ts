import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { SalesQuotesService } from './sales-quotes.service';

@Component({
  selector: 'app-proforma-print',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './proforma-print.html',
})
export class ProformaPrint {
  private readonly service = inject(SalesQuotesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly quoteId = this.route.snapshot.paramMap.get('id')!;
  protected readonly quote = resource({
    params: () => ({ id: this.quoteId }),
    loader: ({ params }) => this.service.get(params.id),
  });
  protected readonly items = resource({
    params: () => ({ id: this.quoteId }),
    loader: ({ params }) => this.service.listItems(params.id),
    defaultValue: [],
  });
  protected readonly technicalReviews = computed(() => [...new Map(this.items.value()
    .filter((item) => item.build_key && item.compatibility_notes)
    .map((item) => [item.build_key, { key: item.build_key, notes: item.compatibility_notes }])).values()]);

  protected print(): void {
    window.print();
  }

  protected back(): void {
    void this.router.navigateByUrl('/proformas');
  }

  protected async duplicate(): Promise<void> {
    const copy = await this.service.duplicate(this.quoteId);
    await this.router.navigate(['/proformas', copy.id, 'edit']);
  }
}
