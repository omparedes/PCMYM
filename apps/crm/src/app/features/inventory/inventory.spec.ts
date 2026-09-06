import { describe, expect, it } from 'vitest';
import {
  calculateMargin,
  calculateProfit,
  movementReasonLabel,
  movementTypeLabel,
} from './inventory.models';

describe('Inventory Domain Logic', () => {
  describe('calculateProfit', () => {
    it('correctly calculates profit between cost and sale price', () => {
      expect(calculateProfit(100, 150)).toBe(50);
      expect(calculateProfit(45.5, 99.9)).toBe(54.4);
    });

    it('returns negative profit for loss selling', () => {
      expect(calculateProfit(120, 100)).toBe(-20);
    });
  });

  describe('calculateMargin', () => {
    it('calculates commercial margin percentage correctly', () => {
      expect(calculateMargin(100, 150)).toBe(50.0);
      expect(calculateMargin(50, 100)).toBe(100.0);
    });

    it('handles zero or negative cost gracefully', () => {
      expect(calculateMargin(0, 100)).toBe(0);
      expect(calculateMargin(-10, 100)).toBe(0);
    });
  });

  describe('Labels and Dictionaries', () => {
    it('returns human-readable Spanish labels for movement types', () => {
      expect(movementTypeLabel('in')).toBe('Entrada');
      expect(movementTypeLabel('out')).toBe('Salida');
      expect(movementTypeLabel('adjustment')).toBe('Ajuste');
    });

    it('returns human-readable Spanish labels for movement reasons', () => {
      expect(movementReasonLabel('initial_stock')).toBe('Inventario inicial');
      expect(movementReasonLabel('purchase')).toBe('Compra / Ingreso');
      expect(movementReasonLabel('service_order')).toBe('Orden de servicio');
      expect(movementReasonLabel('service_return')).toBe('Devolución de orden');
      expect(movementReasonLabel('damaged')).toBe('Producto dañado / Merma');
    });
  });
});
