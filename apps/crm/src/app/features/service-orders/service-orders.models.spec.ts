import { describe, expect, it } from 'vitest';
import {
  WORK_TYPE_OPTIONS,
  calculateEstimatedMinutes,
  normalizeEquipmentType,
  workTypeLabel,
} from './service-orders.models';

describe('Service order work types', () => {
  it('includes warranty as an operational work type', () => {
    expect(WORK_TYPE_OPTIONS).toContain('warranty');
    expect(workTypeLabel('warranty')).toBe('Garantía');
  });

  it('includes maintenance as a standard work type', () => {
    expect(WORK_TYPE_OPTIONS).toContain('maintenance');
    expect(workTypeLabel('maintenance')).toBe('Mantenimiento');
  });
});

describe('normalizeEquipmentType', () => {
  it('identifies desktop, laptop, and other categories', () => {
    expect(normalizeEquipmentType('PC de Escritorio')).toBe('pc');
    expect(normalizeEquipmentType('Laptop HP Pavilion')).toBe('laptop');
    expect(normalizeEquipmentType('Notebook Dell')).toBe('laptop');
    expect(normalizeEquipmentType('Computadora All In One')).toBe('pc');
    expect(normalizeEquipmentType('Impresora multifuncional')).toBe('other');
    expect(normalizeEquipmentType('Monitor Samsung 24"')).toBe('other');
    expect(normalizeEquipmentType(null)).toBe('other');
  });
});

describe('calculateEstimatedMinutes', () => {
  it('calculates maintenance for laptop (60m base)', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'pending', 'in_store', 0);
    expect(minutes).toBe(60);
  });

  it('calculates maintenance for PC (120m base)', () => {
    const minutes = calculateEstimatedMinutes('PC de Escritorio', ['maintenance'], false, 'pending', 'in_store', 0);
    expect(minutes).toBe(120);
  });

  it('calculates formatting with backup (+60m -> 120m total)', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['formatting'], true, 'pending', 'in_store', 0);
    expect(minutes).toBe(120);
  });

  it('calculates formatting without backup (60m)', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['formatting'], false, 'pending', 'in_store', 0);
    expect(minutes).toBe(60);
  });

  it('adds time adjustments correctly', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'repairing', 'in_store', 30);
    expect(minutes).toBe(90);
  });

  it('returns 20m triage time for pending pure repair', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['repair'], false, 'pending', 'in_store', 0);
    expect(minutes).toBe(20);
  });

  it('returns 20m for diagnosing state', () => {
    const minutes = calculateEstimatedMinutes('Laptop', ['repair'], false, 'diagnosing', 'in_store', 0);
    expect(minutes).toBe(20);
  });

  it('returns 0 for orders in external workshop or completed', () => {
    expect(calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'pending', 'external_workshop', 0)).toBe(0);
    expect(calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'delivered', 'in_store', 0)).toBe(0);
    expect(calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'cancelled', 'in_store', 0)).toBe(0);
    expect(calculateEstimatedMinutes('Laptop', ['maintenance'], false, 'ready', 'in_store', 0)).toBe(0);
  });
});

