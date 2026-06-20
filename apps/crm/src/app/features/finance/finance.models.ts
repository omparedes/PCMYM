import type { Database } from '../../core/supabase/database.types';

export type FinancialEntry = Database['public']['Tables']['financial_entries']['Row'];
export type IncomeExpenseMonthly = Database['public']['Views']['v_income_expense_monthly']['Row'];
export type TopCustomer = Database['public']['Views']['v_top_customers']['Row'];
export type TopEquipmentType = Database['public']['Views']['v_top_equipment_types']['Row'];
export type AccountReceivable = Database['public']['Views']['v_accounts_receivable']['Row'];

export type FinancialEntryType = 'income' | 'expense';

export const ENTRY_TYPE_LABELS: Record<FinancialEntryType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
};

export function entryTypeLabel(entryType: string): string {
  return ENTRY_TYPE_LABELS[entryType as FinancialEntryType] ?? entryType;
}
