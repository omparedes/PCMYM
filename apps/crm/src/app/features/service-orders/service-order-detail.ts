import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, form, min, required } from '@angular/forms/signals';

import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderPhotosService } from './service-order-photos.service';
import { PaymentsService } from './payments.service';
import { OrderPartsService } from './order-parts.service';
import { AddOrderPartModalComponent } from './components/add-order-part-modal';
import { EditOrderPartModalComponent } from './components/edit-order-part-modal';
import { ServiceOrderDeliveryModalComponent } from './components/service-order-delivery-modal';
import type { ServiceOrderPartWithProduct } from '../inventory/inventory.models';
import { BudgetsService } from '../budgets/budgets.service';
import { budgetStatusLabel } from '../budgets/budgets.models';
import {
  WORK_TYPE_OPTIONS,
  calculateEstimatedMinutes,
  nextValidStatuses,
  paymentMethodLabel,
  priorityLabel,
  serviceLocationLabel,
  statusLabel,
  workTypeLabel,
} from './service-orders.models';
import type { Payment, PaymentMethod, ServiceLocation, ServiceOrderStatus, ServiceOrderWorkType } from './service-orders.models';
import {
  buildBillableConcepts,
  calculatePaymentDistribution,
  type PaymentDistributionResult,
  type PaymentItemInput,
} from './payment-distribution';

interface PaymentFormModel {
  amount: number | null;
  payment_method: PaymentMethod | '';
  notes: string;
}

function emptyPaymentForm(): PaymentFormModel {
  return { amount: null, payment_method: '', notes: '' };
}

@Component({
  selector: 'app-service-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    FormField,
    AddOrderPartModalComponent,
    EditOrderPartModalComponent,
    ServiceOrderDeliveryModalComponent,
  ],
  templateUrl: './service-order-detail.html',
})
export class ServiceOrderDetail {
  private readonly service = inject(ServiceOrdersService);
  private readonly photosService = inject(ServiceOrderPhotosService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly orderPartsService = inject(OrderPartsService);
  private readonly budgetsService = inject(BudgetsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;

  protected readonly statusLabel = statusLabel;
  protected readonly priorityLabel = priorityLabel;
  protected readonly paymentMethodLabel = paymentMethodLabel;
  protected readonly budgetStatusLabel = budgetStatusLabel;
  protected readonly workTypeLabel = workTypeLabel;
  protected readonly workTypeOptions = WORK_TYPE_OPTIONS;
  protected readonly serviceLocationLabel = serviceLocationLabel;

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

  protected readonly linkCopied = signal(false);
  protected readonly updatingWorkTypes = signal(false);
  protected readonly isDeliveryModalOpen = signal(false);
  protected readonly togglingLocation = signal(false);
  protected readonly showTimeAdjustModal = signal(false);
  protected readonly timeAdjustMinutes = signal(30);
  protected readonly timeAdjustReason = signal('');
  protected readonly adjustingTime = signal(false);

  protected readonly targetMinutes = computed(() => {
    const o = this.order.value();
    if (!o) return null;
    return calculateEstimatedMinutes(
      o.equipment_type,
      o.work_types as ServiceOrderWorkType[],
      o.backup_requested,
      o.status as ServiceOrderStatus,
      o.service_location as ServiceLocation,
      o.time_adjustment_minutes,
    );
  });

  protected readonly elapsedMinutes = computed(() => {
    const o = this.order.value();
    if (!o) return 0;
    const accumulated = o.accumulated_active_seconds ?? 0;
    if (!o.stage_started_at) return Math.floor(accumulated / 60);
    const started = new Date(o.stage_started_at).getTime();
    const sessionSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
    return Math.floor((accumulated + sessionSeconds) / 60);
  });

  protected readonly isOverdue = computed(() => {
    const target = this.targetMinutes();
    if (target === null || target <= 0) return false;
    return this.elapsedMinutes() >= target;
  });

  protected readonly remainingMinutes = computed(() => {
    const target = this.targetMinutes();
    if (target === null) return null;
    return Math.max(0, target - this.elapsedMinutes());
  });

  protected workTypes(): ServiceOrderWorkType[] {
    return (this.order.value()?.work_types ?? []).filter((type): type is ServiceOrderWorkType =>
      WORK_TYPE_OPTIONS.includes(type as ServiceOrderWorkType),
    );
  }

  protected async toggleWorkType(workType: ServiceOrderWorkType): Promise<void> {
    if (this.updatingWorkTypes()) return;
    const o = this.order.value();
    const current = this.workTypes();
    const next = current.includes(workType)
      ? current.filter((item) => item !== workType)
      : [...current, workType];
    this.updatingWorkTypes.set(true);
    try {
      await this.service.updateWorkTypes(this.orderId, next, o?.backup_requested ?? false);
      this.order.reload();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al actualizar los tipos de trabajo');
    } finally {
      this.updatingWorkTypes.set(false);
    }
  }

  protected async toggleBackupRequested(): Promise<void> {
    const o = this.order.value();
    if (!o) return;
    this.updatingWorkTypes.set(true);
    try {
      await this.service.updateWorkTypes(this.orderId, o.work_types ?? [], !o.backup_requested);
      this.order.reload();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al cambiar opción de respaldo');
    } finally {
      this.updatingWorkTypes.set(false);
    }
  }

  protected async toggleLocation(): Promise<void> {
    const o = this.order.value();
    if (!o || this.togglingLocation()) return;
    const targetLocation: ServiceLocation = o.service_location === 'in_store' ? 'external_workshop' : 'in_store';
    const notes = targetLocation === 'external_workshop' ? 'Derivado a taller externo' : 'Retornado a tienda';
    this.togglingLocation.set(true);
    try {
      await this.service.transitionLocation(this.orderId, targetLocation, notes);
      this.order.reload();
      this.history.reload();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al cambiar ubicación de servicio');
    } finally {
      this.togglingLocation.set(false);
    }
  }

  protected openTimeAdjustModal(): void {
    this.timeAdjustMinutes.set(30);
    this.timeAdjustReason.set('');
    this.showTimeAdjustModal.set(true);
  }

  protected closeTimeAdjustModal(): void {
    this.showTimeAdjustModal.set(false);
  }

  protected async submitTimeAdjustment(): Promise<void> {
    if (this.adjustingTime()) return;
    const delta = Number(this.timeAdjustMinutes());
    if (isNaN(delta) || delta === 0) return;
    this.adjustingTime.set(true);
    try {
      await this.service.adjustTime(this.orderId, delta, this.timeAdjustReason().trim() || undefined);
      this.showTimeAdjustModal.set(false);
      this.order.reload();
      this.history.reload();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al ajustar tiempo');
    } finally {
      this.adjustingTime.set(false);
    }
  }

  protected copyTrackingLink(token: string | null): void {
    if (!token) return;
    const url = `${window.location.origin}/seguimiento/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  protected openPrint(kind: 'receipt' | 'delivery'): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/service-orders', this.orderId, 'print', kind]),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected openDeliveryModal(): void {
    this.isDeliveryModalOpen.set(true);
  }

  protected closeDeliveryModal(): void {
    this.isDeliveryModalOpen.set(false);
  }

  protected onDeliveryCompleted(): void {
    this.isDeliveryModalOpen.set(false);
    this.selectedNextStatus.set('');
    this.note.set('');
    this.order.reload();
    this.history.reload();
  }

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

  protected readonly autoSuggestConcept = signal(true);

  protected readonly billableConcepts = computed<PaymentItemInput[]>(() => {
    const approvedBudget = this.budgets.value().find((b) => b.status === 'approved');
    const directParts = (this.orderParts.value() || [])
      .filter((p) => !p.budget_id)
      .map((p) => ({
        id: p.id,
        name: p.product?.name || 'Repuesto / Accesorio',
        quantity: p.quantity,
        unit_price: Number(p.unit_price),
      }));

    return buildBillableConcepts(
      directParts,
      approvedBudget
        ? {
            id: approvedBudget.id,
            folio: approvedBudget.folio,
            total_amount: Number(approvedBudget.total_amount),
          }
        : null,
    );
  });

  protected readonly totalOrderAmount = computed(() => {
    const conceptsTotal = this.billableConcepts().reduce((sum, c) => sum + c.totalAmount, 0);
    return Math.max(conceptsTotal, this.totalPaid());
  });

  protected readonly pendingBalance = computed(() => {
    return Math.max(0, Number((this.totalOrderAmount() - this.totalPaid()).toFixed(2)));
  });

  protected readonly paymentDistribution = computed<PaymentDistributionResult | null>(() => {
    const concepts = this.billableConcepts();
    const amount = Number(this.paymentModel().amount);
    if (!amount || amount <= 0 || concepts.length === 0) return null;
    return calculatePaymentDistribution(concepts, this.totalPaid(), amount);
  });

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
    const willShow = !this.showPaymentForm();
    this.showPaymentForm.set(willShow);
    this.paymentError.set(null);
    if (willShow) {
      this.paymentModel.set(emptyPaymentForm());
    }
  }

  protected setPaymentAmount(amount: number, customNote?: string): void {
    const rounded = Number(amount.toFixed(2));
    const dist = calculatePaymentDistribution(this.billableConcepts(), this.totalPaid(), rounded);
    const note = customNote ?? (this.autoSuggestConcept() ? dist.suggestedNote : this.paymentModel().notes);

    this.paymentModel.update((prev) => ({
      ...prev,
      amount: rounded,
      notes: note,
    }));
  }

  protected onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value === '' ? null : Number(input.value);
    if (val === null || isNaN(val) || val <= 0) {
      this.paymentModel.update((prev) => ({ ...prev, amount: val }));
      return;
    }
    const dist = calculatePaymentDistribution(this.billableConcepts(), this.totalPaid(), val);
    this.paymentModel.update((prev) => ({
      ...prev,
      amount: val,
      notes: this.autoSuggestConcept() && dist.suggestedNote ? dist.suggestedNote : prev.notes,
    }));
  }

  protected toggleAutoSuggestConcept(): void {
    const next = !this.autoSuggestConcept();
    this.autoSuggestConcept.set(next);
    if (next) {
      const amount = Number(this.paymentModel().amount);
      if (amount > 0) {
        const dist = calculatePaymentDistribution(this.billableConcepts(), this.totalPaid(), amount);
        if (dist.suggestedNote) {
          this.paymentModel.update((prev) => ({ ...prev, notes: dist.suggestedNote }));
        }
      }
    }
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
        notes: value.notes?.trim() || null,
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

  protected readonly paymentToDelete = signal<Payment | null>(null);
  protected readonly deletingPayment = signal(false);
  protected readonly deletePaymentError = signal<string | null>(null);

  protected openDeletePaymentModal(payment: Payment): void {
    this.paymentToDelete.set(payment);
    this.deletePaymentError.set(null);
  }

  protected closeDeletePaymentModal(): void {
    this.paymentToDelete.set(null);
    this.deletePaymentError.set(null);
  }

  protected async executeDeletePayment(): Promise<void> {
    const payment = this.paymentToDelete();
    if (!payment || this.deletingPayment()) return;

    this.deletingPayment.set(true);
    this.deletePaymentError.set(null);
    try {
      await this.paymentsService.delete(payment.id);
      this.closeDeletePaymentModal();
      this.payments.reload();
    } catch (err) {
      this.deletePaymentError.set(err instanceof Error ? err.message : 'Error al eliminar el pago');
    } finally {
      this.deletingPayment.set(false);
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
    if (this.selectedNextStatus() === 'delivered') {
      this.openDeliveryModal();
      return;
    }
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

  protected readonly orderParts = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.orderPartsService.listPartsByOrder(params.id),
    defaultValue: [] as ServiceOrderPartWithProduct[],
  });

  protected readonly totalParts = computed(() =>
    this.orderParts.value().reduce((acc, p) => acc + p.quantity * Number(p.unit_price), 0),
  );

  protected readonly isAddPartModalOpen = signal(false);
  protected readonly isEditPartModalOpen = signal(false);
  protected readonly editPartModalMode = signal<'edit' | 'remove'>('edit');
  protected readonly selectedOrderPart = signal<ServiceOrderPartWithProduct | null>(null);

  protected openAddPart(): void {
    this.isAddPartModalOpen.set(true);
  }

  protected closeAddPart(): void {
    this.isAddPartModalOpen.set(false);
  }

  protected openEditPart(part: ServiceOrderPartWithProduct): void {
    this.selectedOrderPart.set(part);
    this.editPartModalMode.set('edit');
    this.isEditPartModalOpen.set(true);
  }

  protected openRemovePart(part: ServiceOrderPartWithProduct): void {
    this.selectedOrderPart.set(part);
    this.editPartModalMode.set('remove');
    this.isEditPartModalOpen.set(true);
  }

  protected closeEditPart(): void {
    this.isEditPartModalOpen.set(false);
    this.selectedOrderPart.set(null);
  }

  protected onPartMutated(): void {
    this.orderParts.reload();
  }
}
