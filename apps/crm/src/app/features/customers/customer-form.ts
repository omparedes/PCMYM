import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';

import { CustomersService } from './customers.service';
import type { DocumentType, NewCustomer } from './customers.models';

interface CustomerFormModel {
  name: string;
  document_type: DocumentType | '';
  document_number: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

function emptyFormModel(): CustomerFormModel {
  return {
    name: '',
    document_type: '',
    document_number: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  };
}

@Component({
  selector: 'app-customer-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, RouterLink],
  templateUrl: './customer-form.html',
})
export class CustomerForm {
  private readonly service = inject(CustomersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly customerId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.customerId !== null;

  protected readonly model = signal<CustomerFormModel>(emptyFormModel());

  protected readonly customerForm = form(this.model, (path) => {
    required(path.name, { message: 'El nombre es obligatorio' });
    email(path.email, {
      when: (ctx) => ctx.value() !== '',
      message: 'Ingresa un email válido',
    });
  });

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected readonly existingCustomer = resource({
    params: () => (this.customerId ? { id: this.customerId } : undefined),
    loader: async ({ params }) => {
      const customer = await this.service.get(params.id);
      this.model.set({
        name: customer.name,
        // The DB CHECK constraint guarantees this is 'DNI' | 'RUC' | null.
        document_type: (customer.document_type as DocumentType | null) ?? '',
        document_number: customer.document_number ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        notes: customer.notes ?? '',
      });
      return customer;
    },
  });

  protected async onSubmit(): Promise<void> {
    this.errorMsg.set(null);
    if (!this.customerForm().valid()) return;

    this.saving.set(true);
    try {
      const input = this.toNewCustomer(this.model());
      if (this.isEditMode && this.customerId) {
        await this.service.update(this.customerId, input);
      } else {
        await this.service.create(input);
      }
      await this.router.navigateByUrl('/customers');
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al guardar el cliente');
    } finally {
      this.saving.set(false);
    }
  }

  private toNewCustomer(value: CustomerFormModel): NewCustomer {
    return {
      name: value.name.trim(),
      document_type: value.document_type === '' ? null : value.document_type,
      document_number: value.document_number.trim() || null,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      address: value.address.trim() || null,
      notes: value.notes.trim() || null,
    };
  }
}
