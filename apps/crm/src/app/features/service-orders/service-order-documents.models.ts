import type { Database } from '../../core/supabase/database.types';
import type { Budget, BudgetItem } from '../budgets/budgets.models';
import type { ServiceOrderPartWithProduct } from '../inventory/inventory.models';
import type { Customer } from '../customers/customers.models';
import type {
  Payment,
  ServiceOrderDelivery,
  ServiceOrderWithCustomer,
} from './service-orders.models';

export type Business = Database['public']['Tables']['businesses']['Row'];

export type ServiceOrderDocumentKind = 'receipt' | 'delivery';

export interface BudgetWithItems extends Budget {
  items: BudgetItem[];
}

export interface ServiceOrderDocumentData {
  order: ServiceOrderWithCustomer;
  customer: Customer;
  business: Business;
  parts: ServiceOrderPartWithProduct[];
  budgets: BudgetWithItems[];
  payments: Payment[];
  delivery: ServiceOrderDelivery | null;
}

export function latestApprovedBudget(data: ServiceOrderDocumentData): BudgetWithItems | null {
  return data.budgets.find((budget) => budget.status === 'approved') ?? null;
}

export function budgetTotal(budget: BudgetWithItems | null): number {
  return budget?.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0) ?? 0;
}

export function partsTotal(parts: ServiceOrderPartWithProduct[]): number {
  return parts.reduce((sum, part) => sum + Number(part.quantity) * Number(part.unit_price), 0);
}

export function paymentsTotal(payments: Payment[]): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

