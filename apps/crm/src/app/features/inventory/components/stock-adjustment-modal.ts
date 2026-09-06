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
import { CommonModule } from '@angular/common';
import { InventoryService } from '../inventory.service';
import type { MovementReason, Product } from '../inventory.models';

@Component({
  selector: 'app-stock-adjustment-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './stock-adjustment-modal.html',
})
export class StockAdjustmentModalComponent {
  private readonly inventoryService = inject(InventoryService);

  readonly isOpen = input.required<boolean>();
  readonly product = input<Product | null>(null);
  readonly initialType = input<'in' | 'out'>('in');

  readonly closeModal = output<void>();
  readonly stockAdjusted = output<Product>();

  protected readonly actionType = signal<'in' | 'out'>('in');
  protected readonly quantity = signal<number>(1);
  protected readonly reason = signal<MovementReason>('purchase');
  protected readonly referenceDoc = signal<string>('');
  protected readonly notes = signal<string>('');

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentStock = computed(() => this.product()?.current_stock ?? 0);

  protected readonly isInsufficient = computed(() => {
    if (this.actionType() === 'out') {
      return this.quantity() > this.currentStock();
    }
    return false;
  });

  protected readonly projectedStock = computed(() => {
    const current = this.currentStock();
    const qty = this.quantity();
    if (this.actionType() === 'in') {
      return current + qty;
    } else {
      return Math.max(0, current - qty);
    }
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        const type = this.initialType();
        this.actionType.set(type);
        this.quantity.set(1);
        this.reason.set(type === 'in' ? 'purchase' : 'sale');
        this.referenceDoc.set('');
        this.notes.set('');
        this.errorMessage.set(null);
      }
    });
  }

  protected setActionType(type: 'in' | 'out'): void {
    this.actionType.set(type);
    this.reason.set(type === 'in' ? 'purchase' : 'sale');
    this.quantity.set(1);
    this.errorMessage.set(null);
  }

  protected setQuantity(val: number): void {
    const clean = isNaN(val) || val < 1 ? 1 : val;
    this.quantity.set(clean);
  }

  protected adjustQty(delta: number): void {
    const next = this.quantity() + delta;
    if (next >= 1) {
      this.quantity.set(next);
    }
  }

  protected setReason(r: MovementReason): void {
    this.reason.set(r);
  }

  protected useMaxAvailable(): void {
    const max = Math.max(1, this.currentStock());
    this.quantity.set(max);
  }

  protected onClose(): void {
    this.closeModal.emit();
  }

  protected async onSubmit(): Promise<void> {
    const p = this.product();
    if (!p) return;

    if (this.isInsufficient()) {
      this.errorMessage.set(
        `Stock insuficiente. El producto solo cuenta con ${this.currentStock()} unidades disponibles.`,
      );
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const delta = this.actionType() === 'in' ? this.quantity() : -this.quantity();
      const updated = await this.inventoryService.adjustStock({
        productId: p.id,
        quantity: delta,
        reason: this.reason(),
        referenceDoc: this.referenceDoc().trim() || null,
        notes: this.notes().trim() || null,
      });

      this.stockAdjusted.emit(updated);
      this.onClose();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al registrar el movimiento');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
