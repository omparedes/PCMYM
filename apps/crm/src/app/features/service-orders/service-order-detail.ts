import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormField, form, min, required } from '@angular/forms/signals';

import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderPhotosService } from './service-order-photos.service';
import { PaymentsService } from './payments.service';
import { BudgetsService } from '../budgets/budgets.service';
import { budgetStatusLabel } from '../budgets/budgets.models';
import { nextValidStatuses, paymentMethodLabel, priorityLabel, statusLabel } from './service-orders.models';
import type { PaymentMethod } from './service-orders.models';

interface PaymentFormModel {
  amount: number | null;
  payment_method: PaymentMethod | '';
}

function emptyPaymentForm(): PaymentFormModel {
  return { amount: null, payment_method: '' };
}

@Component({
  selector: 'app-service-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, FormField],
  templateUrl: './service-order-detail.html',
})
export class ServiceOrderDetail {
  private readonly service = inject(ServiceOrdersService);
  private readonly photosService = inject(ServiceOrderPhotosService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly budgetsService = inject(BudgetsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;

  protected readonly statusLabel = statusLabel;
  protected readonly priorityLabel = priorityLabel;
  protected readonly paymentMethodLabel = paymentMethodLabel;
  protected readonly budgetStatusLabel = budgetStatusLabel;

  protected readonly budgets = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.budgetsService.listByServiceOrder(params.id),
    defaultValue: [],
  });

  protected readonly order = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.service.get(params.id),
  });

  protected readonly history = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.service.history(params.id),
    defaultValue: [],
  });

  protected readonly photos = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.photosService.list(params.id),
    defaultValue: [],
  });

  protected readonly uploadingPhoto = signal(false);
  protected readonly photoError = signal<string | null>(null);

  protected async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.photoError.set(null);
    this.uploadingPhoto.set(true);
    try {
      await this.photosService.upload(this.orderId, file);
      this.photos.reload();
    } catch (err) {
      this.photoError.set(err instanceof Error ? err.message : 'Error al subir la foto');
    } finally {
      this.uploadingPhoto.set(false);
      input.value = '';
    }
  }

  protected readonly payments = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.paymentsService.list(params.id),
    defaultValue: [],
  });

  protected readonly totalPaid = computed(() =>
    this.payments.value().reduce((sum, payment) => sum + Number(payment.amount), 0),
  );

  protected readonly showPaymentForm = signal(false);
  protected readonly paymentModel = signal<PaymentFormModel>(emptyPaymentForm());
  protected readonly paymentForm = form(this.paymentModel, (path) => {
    required(path.amount, { message: 'El monto es obligatorio' });
    min(path.amount, 0.01, { message: 'El monto debe ser mayor a 0' });
    required(path.payment_method, { message: 'Selecciona un método de pago' });
  });

  protected readonly savingPayment = signal(false);
  protected readonly paymentError = signal<string | null>(null);

  protected togglePaymentForm(): void {
    this.showPaymentForm.set(!this.showPaymentForm());
    this.paymentModel.set(emptyPaymentForm());
    this.paymentError.set(null);
  }

  protected async submitPayment(): Promise<void> {
    this.paymentError.set(null);
    if (!this.paymentForm().valid()) return;

    this.savingPayment.set(true);
    try {
      const value = this.paymentModel();
      await this.paymentsService.create(this.orderId, {
        amount: value.amount!,
        payment_method: value.payment_method as PaymentMethod,
      });
      this.paymentModel.set(emptyPaymentForm());
      this.showPaymentForm.set(false);
      this.payments.reload();
    } catch (err) {
      this.paymentError.set(err instanceof Error ? err.message : 'Error al registrar el pago');
    } finally {
      this.savingPayment.set(false);
    }
  }

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
