import { describe, expect, it } from 'vitest';
import { WORK_TYPE_OPTIONS, workTypeLabel } from './service-orders.models';

describe('Service order work types', () => {
  it('includes warranty as an operational work type', () => {
    expect(WORK_TYPE_OPTIONS).toContain('warranty');
    expect(workTypeLabel('warranty')).toBe('Garantía');
  });
});

