import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormField, form, min, required } from '@angular/forms/signals';
import { ServiceOrdersService } from '../service-orders.service';

interface DeliveryFormModel {
  receiver_name: string;
  receiver_document: string;
  work_summary: string;
  delivery_notes: string;
  warranty_days: number;
  warranty_terms: string;
}

function emptyDeliveryForm(): DeliveryFormModel {
  return {
    receiver_name: '',
    receiver_document: '',
    work_summary: '',
    delivery_notes: '',
    warranty_days: 30,
    warranty_terms: 'Garantía sobre el servicio realizado. No cubre golpes, líquidos ni manipulación externa.',
  };
}

@Component({
  selector: 'app-service-order-delivery-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField],
  templateUrl: './service-order-delivery-modal.html',
})
export class ServiceOrderDeliveryModalComponent {
  private readonly service = inject(ServiceOrdersService);

  readonly isOpen = input.required<boolean>();
  readonly orderId = input.required<string>();
  readonly closeModal = output<void>();
  readonly delivered = output<void>();

  protected readonly model = signal<DeliveryFormModel>(emptyDeliveryForm());
  protected readonly deliveryForm = form(this.model, (path) => {
    required(path.receiver_name, { message: 'Indica quién recibe el equipo' });
    min(path.warranty_days, 0, { message: 'Los días de garantía no pueden ser negativos' });
  });
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.model.set(emptyDeliveryForm());
        this.errorMessage.set(null);
      }
    });
  }

  protected async submit(): Promise<void> {
    this.errorMessage.set(null);
    if (!this.deliveryForm().valid()) return;

    this.isSubmitting.set(true);
    try {
      const value = this.model();
      await this.service.deliver(this.orderId(), {
        receiver_name: value.receiver_name.trim(),
        receiver_document: value.receiver_document.trim() || null,
        work_summary: value.work_summary.trim() || null,
        delivery_notes: value.delivery_notes.trim() || null,
        warranty_days: Number(value.warranty_days) || 0,
        warranty_terms: value.warranty_terms.trim() || null,
      });
      this.delivered.emit();
      this.closeModal.emit();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'No se pudo registrar la entrega');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected close(): void {
    if (!this.isSubmitting()) this.closeModal.emit();
  }
}

