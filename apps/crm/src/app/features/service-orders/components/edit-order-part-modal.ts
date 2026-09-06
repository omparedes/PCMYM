import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OrderPartsService } from '../order-parts.service';
import type { ServiceOrderPartWithProduct } from '../../inventory/inventory.models';

@Component({
  selector: 'app-edit-order-part-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './edit-order-part-modal.html',
})
export class EditOrderPartModalComponent {
  private readonly orderPartsService = inject(OrderPartsService);

  readonly isOpen = input.required<boolean>();
  readonly orderId = input.required<string>();
  readonly part = input<ServiceOrderPartWithProduct | null>(null);
  readonly mode = input<'edit' | 'remove'>('edit');

  readonly closeModal = output<void>();
  readonly partUpdated = output<void>();

  protected readonly quantity = signal<number>(1);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      const p = this.part();
      if (p) {
        this.quantity.set(p.quantity);
        this.errorMessage.set(null);
      }
    });
  }

  protected readonly delta = computed(() => {
    const p = this.part();
    if (!p) return 0;
    return this.quantity() - p.quantity;
  });

  protected readonly availableInWarehouse = computed(() => {
    const p = this.part();
    return p?.product?.current_stock ?? 0;
  });

  protected readonly maxAllowed = computed(() => {
    const p = this.part();
    if (!p) return 1;
    return p.quantity + this.availableInWarehouse();
  });

  protected readonly newSubtotal = computed(() => {
    const p = this.part();
    if (!p) return 0;
    return this.quantity() * Number(p.unit_price);
  });

  protected incrementQty(): void {
    if (this.quantity() < this.maxAllowed()) {
      this.quantity.update((q) => q + 1);
    }
  }

  protected decrementQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  protected async submitEdit(): Promise<void> {
    const p = this.part();
    if (!p) return;

    if (this.quantity() === p.quantity) {
      this.closeModal.emit();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.orderPartsService.modifyPartQuantity(
        this.orderId(),
        p.product_id,
        this.quantity(),
      );
      this.partUpdated.emit();
      this.closeModal.emit();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al modificar cantidad');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async submitRemove(): Promise<void> {
    const p = this.part();
    if (!p) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.orderPartsService.removePartFromOrder(this.orderId(), p.product_id);
      this.partUpdated.emit();
      this.closeModal.emit();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al quitar repuesto');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected handleClose(): void {
    this.errorMessage.set(null);
    this.closeModal.emit();
  }
}
