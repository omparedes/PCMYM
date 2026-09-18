import { describe, expect, it } from 'vitest';
import {
  buildBillableConcepts,
  calculatePaymentDistribution,
} from './payment-distribution';

describe('Payment Distribution Logic (Order #44 scenario and beyond)', () => {
  const directParts = [
    { id: 'part-1', name: 'Adaptador Bluetooth USB', quantity: 1, unit_price: 45.0 },
  ];
  const approvedBudget = { id: 'budget-10', folio: 10, total_amount: 30.0 };

  it('builds billable concepts ordered with products first, then service', () => {
    const concepts = buildBillableConcepts(directParts, approvedBudget);
    expect(concepts).toHaveLength(2);
    expect(concepts[0].type).toBe('product');
    expect(concepts[0].name).toBe('Adaptador Bluetooth USB');
    expect(concepts[0].totalAmount).toBe(45.0);

    expect(concepts[1].type).toBe('service');
    expect(concepts[1].name).toBe('Servicio Técnico (Presupuesto #10)');
    expect(concepts[1].totalAmount).toBe(30.0);
  });

  it('handles Order #44 Payment 1: advance of S/ 50.00 (covers product 100%, abona 5.00 to service)', () => {
    const concepts = buildBillableConcepts(directParts, approvedBudget);
    const result = calculatePaymentDistribution(concepts, 0, 50.0);

    expect(result.totalOrderAmount).toBe(75.0);
    expect(result.pendingBalanceBefore).toBe(75.0);
    expect(result.paymentAmount).toBe(50.0);
    expect(result.remainingBalanceAfter).toBe(25.0);

    // Concept 1 (Product)
    const p1 = result.concepts[0];
    expect(p1.allocatedAmount).toBe(45.0);
    expect(p1.remainingBalance).toBe(0.0);
    expect(p1.isFullyCovered).toBe(true);

    // Concept 2 (Service)
    const p2 = result.concepts[1];
    expect(p2.allocatedAmount).toBe(5.0);
    expect(p2.remainingBalance).toBe(25.0);
    expect(p2.isFullyCovered).toBe(false);

    expect(result.suggestedNote).toContain('Adaptador Bluetooth USB (S/ 45.00)');
    expect(result.suggestedNote).toContain('Abono Servicio Técnico (Presupuesto #10) (S/ 5.00)');
  });

  it('handles Order #44 Payment 2: remaining S/ 25.00 after S/ 50.00 previously paid', () => {
    const concepts = buildBillableConcepts(directParts, approvedBudget);
    const result = calculatePaymentDistribution(concepts, 50.0, 25.0);

    expect(result.totalOrderAmount).toBe(75.0);
    expect(result.totalPaidBefore).toBe(50.0);
    expect(result.pendingBalanceBefore).toBe(25.0);
    expect(result.paymentAmount).toBe(25.0);
    expect(result.remainingBalanceAfter).toBe(0.0);

    // Concept 1 was already paid in full
    const p1 = result.concepts[0];
    expect(p1.previouslyPaid).toBe(45.0);
    expect(p1.allocatedAmount).toBe(0.0);
    expect(p1.remainingBalance).toBe(0.0);

    // Concept 2 receives the final 25.0
    const p2 = result.concepts[1];
    expect(p2.previouslyPaid).toBe(5.0);
    expect(p2.allocatedAmount).toBe(25.0);
    expect(p2.remainingBalance).toBe(0.0);
    expect(p2.isFullyCovered).toBe(true);

    expect(result.suggestedNote).toContain('Saldo de Servicio Técnico (Presupuesto #10)');
  });

  it('handles full payment of S/ 75.00 in a single transaction', () => {
    const concepts = buildBillableConcepts(directParts, approvedBudget);
    const result = calculatePaymentDistribution(concepts, 0, 75.0);

    expect(result.remainingBalanceAfter).toBe(0.0);
    expect(result.concepts[0].allocatedAmount).toBe(45.0);
    expect(result.concepts[1].allocatedAmount).toBe(30.0);
    expect(result.suggestedNote).toContain('Adaptador Bluetooth USB (S/ 45.00)');
    expect(result.suggestedNote).toContain('Servicio Técnico (Presupuesto #10) (S/ 30.00)');
  });

  it('handles free-form payment when there are no prior concepts (express service without budget)', () => {
    const concepts = buildBillableConcepts([], null);
    const result = calculatePaymentDistribution(concepts, 0, 35.0);

    expect(result.totalOrderAmount).toBe(0);
    expect(result.paymentAmount).toBe(35.0);
    expect(result.concepts).toHaveLength(0);
    expect(result.suggestedNote).toBe('Abono general');
  });

  it('handles partial payment smaller than the first product', () => {
    const concepts = buildBillableConcepts(directParts, approvedBudget);
    const result = calculatePaymentDistribution(concepts, 0, 20.0);

    expect(result.concepts[0].allocatedAmount).toBe(20.0);
    expect(result.concepts[0].remainingBalance).toBe(25.0);
    expect(result.concepts[0].isFullyCovered).toBe(false);

    expect(result.concepts[1].allocatedAmount).toBe(0.0);
    expect(result.concepts[1].remainingBalance).toBe(30.0);

    expect(result.suggestedNote).toContain('Abono a Adaptador Bluetooth USB (S/ 20.00)');
  });
});
