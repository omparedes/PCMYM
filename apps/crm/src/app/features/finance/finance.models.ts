import type { Database } from '../../core/supabase/database.types';

export type FinancialEntry = Database['public']['Tables']['financial_entries']['Row'];

export type FinancialEntryType = 'income' | 'expense';

export const ENTRY_TYPE_LABELS: Record<FinancialEntryType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
};

export function entryTypeLabel(entryType: string): string {
  return ENTRY_TYPE_LABELS[entryType as FinancialEntryType] ?? entryType;
}
