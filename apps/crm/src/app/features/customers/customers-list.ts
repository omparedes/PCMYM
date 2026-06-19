import { ChangeDetectionStrategy, Component, debounced, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CustomersService } from './customers.service';
import { documentTypeLabel } from './customers.models';

@Component({
  selector: 'app-customers-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './customers-list.html',
})
export class CustomersList {
  private readonly service = inject(CustomersService);

  protected readonly documentTypeLabel = documentTypeLabel;

  protected readonly searchInput = signal('');
  protected readonly includeArchived = signal(false);

  private readonly debouncedSearch = debounced(() => this.searchInput(), 300);

  protected readonly customers = resource({
    params: () => ({
      search: this.debouncedSearch.value(),
      includeArchived: this.includeArchived(),
    }),
    loader: ({ params }) => this.service.list(params),
    defaultValue: [],
  });

  protected onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  protected onIncludeArchivedChange(event: Event): void {
    this.includeArchived.set((event.target as HTMLInputElement).checked);
  }

  protected async toggleArchived(id: string, isArchived: boolean): Promise<void> {
    if (isArchived) {
      await this.service.unarchive(id);
    } else {
      await this.service.archive(id);
    }
    this.customers.reload();
  }
}
