import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';

import { ServiceOrdersService } from './service-orders.service';
import { PRIORITY_LABELS, type ServiceOrderPriority } from './service-orders.models';
import { CustomersService } from '../customers/customers.service';
import { ProfilesService } from '../../core/profiles/profiles.service';

// Signal Forms' native control binding maps DOM values to plain string/number/
// boolean — it does not accept `string | null`. So the form model here uses
// plain strings ('' = empty) and gets converted to the nullable API model
// (NewServiceOrder) on submit, same pattern as CustomerForm.
interface ServiceOrderFormModel {
  customer_id: string;
  equipment_type: string;
  brand: string;
  model: string;
  serial_number: string;
  accessories: string;
  reported_issue: string;
  initial_diagnosis: string;
  priority: ServiceOrderPriority;
  assigned_to: string;
  estimated_delivery: string;
}

function emptyFormModel(): ServiceOrderFormModel {
  return {
    customer_id: '',
    equipment_type: '',
    brand: '',
    model: '',
    serial_number: '',
    accessories: '',
    reported_issue: '',
    initial_diagnosis: '',
    priority: 'normal',
    assigned_to: '',
    estimated_delivery: '',
  };
}

@Component({
  selector: 'app-service-order-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, RouterLink],
  templateUrl: './service-order-form.html',
})
export class ServiceOrderForm {
  private readonly service = inject(ServiceOrdersService);
  private readonly customersService = inject(CustomersService);
  private readonly profilesService = inject(ProfilesService);
  private readonly router = inject(Router);

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorityOptions = Object.keys(PRIORITY_LABELS) as ServiceOrderPriority[];

  protected readonly customers = resource({
    loader: () => this.customersService.list({ search: '', includeArchived: false }),
    defaultValue: [],
  });

  protected readonly profiles = resource({
    loader: () => this.profilesService.list(),
    defaultValue: [],
  });

  // Toggle between picking an existing customer and creating one inline.
  protected readonly creatingNewCustomer = signal(false);
  protected readonly newCustomerName = signal('');
  protected readonly newCustomerPhone = signal('');

  protected readonly model = signal<ServiceOrderFormModel>(emptyFormModel());

  // No validators yet: every field here is optional except customer_id, which
  // has its own inline-create-or-select logic handled outside the form schema.
  protected readonly orderForm = form(this.model);

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected toggleNewCustomer(): void {
    this.creatingNewCustomer.set(!this.creatingNewCustomer());
    this.model.update((m) => ({ ...m, customer_id: '' }));
  }

  protected async onSubmit(): Promise<void> {
    this.errorMsg.set(null);

    let customerId = this.model().customer_id;

    if (this.creatingNewCustomer()) {
      const name = this.newCustomerName().trim();
      if (!name) {
        this.errorMsg.set('El nombre del cliente nuevo es obligatorio');
        return;
      }
      this.saving.set(true);
      try {
        const newCustomer = await this.customersService.create({
          name,
          document_type: null,
          document_number: null,
          phone: this.newCustomerPhone().trim() || null,
          email: null,
          address: null,
          notes: null,
        });
        customerId = newCustomer.id;
      } catch (err) {
        this.saving.set(false);
        this.errorMsg.set(err instanceof Error ? err.message : 'Error al crear el cliente');
        return;
      }
    }

    if (!customerId) {
      this.errorMsg.set('Selecciona o crea un cliente');
      return;
    }

    this.saving.set(true);
    try {
      const value = this.model();
      const order = await this.service.create({
        customer_id: customerId,
        equipment_type: value.equipment_type.trim() || null,
        brand: value.brand.trim() || null,
        model: value.model.trim() || null,
        serial_number: value.serial_number.trim() || null,
        accessories: value.accessories.trim() || null,
        reported_issue: value.reported_issue.trim() || null,
        initial_diagnosis: value.initial_diagnosis.trim() || null,
        priority: value.priority,
        assigned_to: value.assigned_to || null,
        estimated_delivery: value.estimated_delivery || null,
      });
      await this.router.navigate(['/service-orders', order.id]);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al crear la orden');
    } finally {
      this.saving.set(false);
    }
  }
}
