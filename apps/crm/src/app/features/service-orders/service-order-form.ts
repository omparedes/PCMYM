import { ChangeDetectionStrategy, Component, effect, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';

import { ServiceOrdersService } from './service-orders.service';
import {
  PRIORITY_LABELS,
  WORK_TYPE_LABELS,
  WORK_TYPE_OPTIONS,
  type ServiceOrderPriority,
  type ServiceOrderWorkType,
} from './service-orders.models';
import { CustomersService } from '../customers/customers.service';
import type { Customer } from '../customers/customers.models';
import { AuthService } from '../../core/auth/auth.service';
import { ProfilesService } from '../../core/profiles/profiles.service';

interface ServiceOrderFormModel {
  customer_id: string;
  equipment_type: string;
  brand: string;
  model: string;
  serial_number: string;
  reported_issue: string;
  initial_diagnosis: string;
  priority: ServiceOrderPriority;
  assigned_to: string;
  estimated_delivery: string;
}

function emptyFormModel(): ServiceOrderFormModel {
  return {
    customer_id: '', equipment_type: '', brand: '', model: '', serial_number: '',
    reported_issue: '', initial_diagnosis: '', priority: 'normal', assigned_to: '', estimated_delivery: '',
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly priorityOptions = Object.keys(PRIORITY_LABELS) as ServiceOrderPriority[];
  protected readonly workTypeLabels = WORK_TYPE_LABELS;
  protected readonly workTypeOptions = WORK_TYPE_OPTIONS;
  protected readonly equipmentSuggestions = ['Laptop', 'PC de escritorio', 'All-in-One', 'Impresora', 'Monitor'];
  protected readonly brandSuggestions = ['HP', 'Lenovo', 'Dell', 'Asus', 'Acer', 'Apple', 'Toshiba'];
  protected readonly accessorySuggestions = ['Cargador', 'Mouse', 'Funda', 'Batería', 'Cable de poder', 'Adaptador'];

  protected readonly profiles = resource({ loader: () => this.profilesService.list(), defaultValue: [] });
  protected readonly customerSearch = signal('');
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly creatingNewCustomer = signal(false);
  protected readonly newCustomerPhone = signal('');
  protected readonly accessoryInput = signal('');
  protected readonly accessories = signal<string[]>([]);
  protected readonly selectedWorkTypes = signal<ServiceOrderWorkType[]>([]);

  protected readonly matchingCustomers = resource({
    params: () => ({ search: this.customerSearch().trim() }),
    loader: ({ params }) => params.search.length > 0
      ? this.customersService.list({ search: params.search, includeArchived: false })
      : Promise.resolve([]),
    defaultValue: [] as Customer[],
  });

  protected readonly model = signal<ServiceOrderFormModel>(emptyFormModel());
  protected readonly orderForm = form(this.model);
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  constructor() {
    // The authenticated profile is the default technician; the selector remains
    // available when another technician needs to be assigned.
    effect(() => {
      const userId = this.auth.session()?.user.id;
      if (userId && !this.model().assigned_to) {
        this.model.update((value) => ({ ...value, assigned_to: userId }));
      }
    });
  }

  protected selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.creatingNewCustomer.set(false);
    this.customerSearch.set(customer.name);
    this.model.update((value) => ({ ...value, customer_id: customer.id }));
  }

  protected clearCustomer(): void {
    this.selectedCustomer.set(null);
    this.customerSearch.set('');
    this.model.update((value) => ({ ...value, customer_id: '' }));
  }

  protected createCustomerInline(): void {
    this.clearCustomer();
    this.creatingNewCustomer.set(true);
  }

  protected toggleWorkType(workType: ServiceOrderWorkType): void {
    this.selectedWorkTypes.update((current) => current.includes(workType)
      ? current.filter((item) => item !== workType)
      : [...current, workType]);
  }

  protected addAccessory(value = this.accessoryInput()): void {
    const accessory = value.trim();
    if (!accessory || this.accessories().some((item) => item.toLowerCase() === accessory.toLowerCase())) return;
    this.accessories.update((items) => [...items, accessory]);
    this.accessoryInput.set('');
  }

  protected removeAccessory(accessory: string): void {
    this.accessories.update((items) => items.filter((item) => item !== accessory));
  }

  protected async onSubmit(): Promise<void> {
    this.errorMsg.set(null);
    let customerId = this.model().customer_id;

    if (this.creatingNewCustomer()) {
      const name = this.customerSearch().trim();
      if (!name) {
        this.errorMsg.set('El nombre del cliente nuevo es obligatorio');
        return;
      }
      this.saving.set(true);
      try {
        const customer = await this.customersService.create({
          name, document_type: null, document_number: null,
          phone: this.newCustomerPhone().trim() || null,
          email: null, address: null, notes: null,
        });
        customerId = customer.id;
      } catch (err) {
        this.saving.set(false);
        this.errorMsg.set(err instanceof Error ? err.message : 'Error al crear el cliente');
        return;
      }
    }

    if (!customerId) {
      this.errorMsg.set('Busca y selecciona un cliente, o registra uno nuevo');
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
        accessories: this.accessories().join(', ') || null,
        reported_issue: value.reported_issue.trim() || null,
        initial_diagnosis: value.initial_diagnosis.trim() || null,
        priority: value.priority,
        assigned_to: value.assigned_to || null,
        estimated_delivery: value.estimated_delivery || null,
        work_types: this.selectedWorkTypes(),
      });
      await this.router.navigate(['/service-orders', order.id]);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Error al crear la orden');
    } finally {
      this.saving.set(false);
    }
  }

}
