export interface PaymentItemInput {
  id: string;
  type: 'product' | 'service';
  name: string;
  totalAmount: number;
}

export interface DistributedConcept {
  id: string;
  type: 'product' | 'service';
  name: string;
  totalAmount: number;
  previouslyPaid: number;
  currentPending: number;
  allocatedAmount: number;
  remainingBalance: number;
  isFullyCovered: boolean;
}

export interface PaymentDistributionResult {
  totalOrderAmount: number;
  totalPaidBefore: number;
  pendingBalanceBefore: number;
  paymentAmount: number;
  remainingBalanceAfter: number;
  concepts: DistributedConcept[];
  suggestedNote: string;
}

/**
 * Builds the list of billable concepts for a service order.
 * - Direct parts: items in service_order_parts where budget_id is null.
 * - Approved budget: the approved budget (labor/parts quote).
 */
export function buildBillableConcepts(
  directParts: { id: string; name: string; quantity: number; unit_price: number }[],
  approvedBudget: { id: string; folio?: number | null; total_amount: number } | null,
): PaymentItemInput[] {
  const concepts: PaymentItemInput[] = [];

  // Priority 1: Physical products/parts
  for (const part of directParts) {
    const total = Number(part.quantity) * Number(part.unit_price);
    if (total > 0) {
      concepts.push({
        id: part.id,
        type: 'product',
        name: part.name || 'Repuesto / Accesorio',
        totalAmount: Number(total.toFixed(2)),
      });
    }
  }

  // Priority 2: Service technical / approved budget
  if (approvedBudget && Number(approvedBudget.total_amount) > 0) {
    concepts.push({
      id: approvedBudget.id,
      type: 'service',
      name: approvedBudget.folio ? `Servicio Técnico (Presupuesto #${approvedBudget.folio})` : 'Servicio Técnico',
      totalAmount: Number(Number(approvedBudget.total_amount).toFixed(2)),
    });
  }

  return concepts;
}

/**
 * Distributes past payments and a new payment amount across billable concepts.
 * Rule: Products are covered first to ensure hardware inventory is paid,
 * then technical services/labor.
 */
export function calculatePaymentDistribution(
  concepts: PaymentItemInput[],
  totalPaidBefore: number,
  newPaymentAmount: number,
): PaymentDistributionResult {
  const safePaidBefore = Math.max(0, Number(totalPaidBefore) || 0);
  const safePaymentAmount = Math.max(0, Number(newPaymentAmount) || 0);

  const totalOrderAmount = Number(
    concepts.reduce((sum, c) => sum + c.totalAmount, 0).toFixed(2),
  );
  const pendingBalanceBefore = Math.max(0, Number((totalOrderAmount - safePaidBefore).toFixed(2)));

  // 1. Impute previously paid amounts across concepts
  let remainingPastPaid = safePaidBefore;
  const conceptStates = concepts.map((concept) => {
    const allocatedPast = Math.min(concept.totalAmount, remainingPastPaid);
    remainingPastPaid = Number((remainingPastPaid - allocatedPast).toFixed(2));
    const currentPending = Number((concept.totalAmount - allocatedPast).toFixed(2));
    return {
      ...concept,
      previouslyPaid: Number(allocatedPast.toFixed(2)),
      currentPending,
    };
  });

  // 2. Allocate the new payment amount across currently pending concepts
  let remainingNewPayment = safePaymentAmount;
  const distributedConcepts: DistributedConcept[] = conceptStates.map((c) => {
    const allocated = Math.min(c.currentPending, remainingNewPayment);
    remainingNewPayment = Number((remainingNewPayment - allocated).toFixed(2));
    const remainingBalance = Number((c.currentPending - allocated).toFixed(2));
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      totalAmount: c.totalAmount,
      previouslyPaid: c.previouslyPaid,
      currentPending: c.currentPending,
      allocatedAmount: Number(allocated.toFixed(2)),
      remainingBalance,
      isFullyCovered: remainingBalance === 0,
    };
  });

  const remainingBalanceAfter = Math.max(
    0,
    Number((pendingBalanceBefore - safePaymentAmount).toFixed(2)),
  );

  // 3. Formulate the suggested concept note
  const activeAllocations = distributedConcepts.filter((c) => c.allocatedAmount > 0);
  let suggestedNote = '';

  if (activeAllocations.length === 0) {
    if (safePaymentAmount > 0) {
      suggestedNote = 'Abono general';
    }
  } else if (activeAllocations.length === 1) {
    const item = activeAllocations[0];
    if (item.isFullyCovered && item.currentPending === item.totalAmount) {
      suggestedNote = item.name;
    } else if (item.isFullyCovered) {
      suggestedNote = `Saldo de ${item.name}`;
    } else {
      suggestedNote = `Abono a ${item.name} (S/ ${item.allocatedAmount.toFixed(2)})`;
    }
  } else {
    // Multiple items covered or partially covered
    const parts = activeAllocations.map((item) => {
      if (item.isFullyCovered && item.currentPending === item.totalAmount) {
        return `${item.name} (S/ ${item.allocatedAmount.toFixed(2)})`;
      }
      if (item.isFullyCovered) {
        return `Saldo ${item.name} (S/ ${item.allocatedAmount.toFixed(2)})`;
      }
      return `Abono ${item.name} (S/ ${item.allocatedAmount.toFixed(2)})`;
    });
    suggestedNote = parts.join(' + ');
  }

  return {
    totalOrderAmount,
    totalPaidBefore: safePaidBefore,
    pendingBalanceBefore,
    paymentAmount: safePaymentAmount,
    remainingBalanceAfter,
    concepts: distributedConcepts,
    suggestedNote,
  };
}
