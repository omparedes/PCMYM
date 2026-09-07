import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { ServiceOrderDocumentsService } from './service-order-documents.service';
import {
  budgetTotal,
  latestApprovedBudget,
  partsTotal,
  paymentsTotal,
} from './service-order-documents.models';
import type { ServiceOrderDocumentKind } from './service-order-documents.models';
import { paymentMethodLabel, statusLabel } from './service-orders.models';

@Component({
  selector: 'app-service-order-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './service-order-print.html',
  styles: [`
    :host { display: block; min-height: 100vh; background: #f1f5f9; color: #0f172a; }
    @media print {
      :host { min-height: auto; background: #fff; }
      .print-toolbar { display: none !important; }
      .print-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; max-width: none !important; }
      .avoid-break { break-inside: avoid; }
    }
  `],
})
export class ServiceOrderPrint {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documents = inject(ServiceOrderDocumentsService);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;
  protected readonly kind = (this.route.snapshot.paramMap.get('kind') === 'delivery' ? 'delivery' : 'receipt') as ServiceOrderDocumentKind;
  protected readonly isDelivery = this.kind === 'delivery';
  protected readonly document = resource({
    params: () => ({ id: this.orderId }),
    loader: ({ params }) => this.documents.getData(params.id),
  });
  protected readonly qrCode = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  private autoPrinted = false;

  protected readonly approvedBudget = computed(() => {
    const data = this.document.value();
    return data ? latestApprovedBudget(data) : null;
  });

  protected readonly partsAmount = computed(() => partsTotal(this.document.value()?.parts ?? []));
  protected readonly paidAmount = computed(() => paymentsTotal(this.document.value()?.payments ?? []));
  protected readonly documentTotal = computed(() => {
    const budget = this.approvedBudget();
    return budget ? budgetTotal(budget) : this.partsAmount();
  });
  protected readonly balanceDue = computed(() => Math.max(this.documentTotal() - this.paidAmount(), 0));

  protected readonly statusLabel = statusLabel;
  protected readonly paymentMethodLabel = paymentMethodLabel;

  constructor() {
    effect(() => {
      const data = this.document.value();
      if (!data || this.autoPrinted) return;
      if (this.isDelivery && !data.delivery) return;
      this.autoPrinted = true;
      void this.preparePrint(data.order.tracking_token);
    });
  }

  protected print(): void {
    window.print();
  }

  protected backToOrder(): void {
    void this.router.navigate(['/service-orders', this.orderId]);
  }

  protected trackingUrl(token: string): string {
    return `${window.location.origin}/seguimiento/${token}`;
  }

  protected warrantyLabel(): string {
    const delivery = this.document.value()?.delivery;
    if (!delivery || delivery.warranty_days <= 0) return 'Sin garantía registrada';
    const until = delivery.warranty_until ? ` hasta el ${delivery.warranty_until}` : '';
    return `${delivery.warranty_days} días${until}`;
  }

  private async preparePrint(token: string): Promise<void> {
    try {
      const url = this.trackingUrl(token);
      this.qrCode.set(await QRCode.toDataURL(url, { width: 170, margin: 1, errorCorrectionLevel: 'M' }));
      setTimeout(() => window.print(), 350);
    } catch {
      this.errorMessage.set('No se pudo generar el código QR. Puedes imprimir y usar el enlace de seguimiento.');
      setTimeout(() => window.print(), 350);
    }
  }
}
