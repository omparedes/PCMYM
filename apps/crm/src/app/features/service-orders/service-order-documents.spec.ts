import { describe, expect, it } from 'vitest';
import { budgetTotal, latestApprovedBudget, partsTotal, paymentsTotal } from './service-order-documents.models';
import type { ServiceOrderDocumentData } from './service-order-documents.models';

const baseData = {
  order: {} as ServiceOrderDocumentData['order'],
  customer: {} as ServiceOrderDocumentData['customer'],
  business: {} as ServiceOrderDocumentData['business'],
  parts: [],
  budgets: [],
  payments: [],
  delivery: null,
} satisfies ServiceOrderDocumentData;

describe('Service order document totals', () => {
  it('selects the latest approved budget and calculates its lines', () => {
    const data: ServiceOrderDocumentData = {
      ...baseData,
      budgets: [
        { id: 'rejected', status: 'rejected', items: [], total_amount: 0 } as never,
        {
          id: 'approved',
          status: 'approved',
          items: [
            { id: 'item-1', quantity: 2, unit_price: 25 } as never,
            { id: 'item-2', quantity: 1, unit_price: 40 } as never,
          ],
          total_amount: 90,
        } as never,
      ],
    };

    const budget = latestApprovedBudget(data);
    expect(budget?.id).toBe('approved');
    expect(budgetTotal(budget)).toBe(90);
  });

  it('calculates parts, payments and never returns a negative balance input', () => {
    expect(partsTotal([{ quantity: 2, unit_price: 14 } as never])).toBe(28);
    expect(paymentsTotal([{ amount: 30 } as never, { amount: 12.5 } as never])).toBe(42.5);
  });
});

