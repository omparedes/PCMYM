import {
  ChangeDetectionStrategy,
  Component,
  inject,
  resource,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { InventoryService } from '../inventory.service';
import { movementReasonLabel, movementTypeLabel } from '../inventory.models';

@Component({
  selector: 'app-inventory-movements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],
  templateUrl: './inventory-movements.html',
})
export class InventoryMovementsComponent {
  private readonly inventoryService = inject(InventoryService);

  protected readonly movementReasonLabel = movementReasonLabel;
  protected readonly movementTypeLabel = movementTypeLabel;

  protected readonly filterType = signal<string>('all');
  protected readonly searchTerm = signal<string>('');

  protected readonly movements = resource({
    params: () => ({
      type: this.filterType(),
      search: this.searchTerm(),
    }),
    loader: async ({ params }) => {
      const all = await this.inventoryService.listAllMovements({
        type: params.type,
      });

      if (params.search && params.search.trim()) {
        const term = params.search.toLowerCase().trim();
        return all.filter(
          (m) =>
            m.product?.name?.toLowerCase().includes(term) ||
            m.product?.sku?.toLowerCase().includes(term) ||
            m.reference_doc?.toLowerCase().includes(term) ||
            m.notes?.toLowerCase().includes(term) ||
            m.reason.toLowerCase().includes(term),
        );
      }

      return all;
    },
    defaultValue: [],
  });

  protected setFilterType(type: string): void {
    this.filterType.set(type);
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  public reload(): void {
    this.movements.reload();
  }
}
