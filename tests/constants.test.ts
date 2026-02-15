import { describe, it, expect } from 'vitest';
import { TAX_RATE, PRECISION_THRESHOLD, DEFAULT_WASTAGE, QUOTE_NUMBER_OFFSET } from '../utils/constants';

describe('constants', () => {
  it('TAX_RATE is 15%', () => {
    expect(TAX_RATE).toBe(0.15);
  });

  it('PRECISION_THRESHOLD is a small positive number', () => {
    expect(PRECISION_THRESHOLD).toBeGreaterThan(0);
    expect(PRECISION_THRESHOLD).toBeLessThan(1);
  });

  it('DEFAULT_WASTAGE is reasonable', () => {
    expect(DEFAULT_WASTAGE).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_WASTAGE).toBeLessThanOrEqual(100);
  });

  it('QUOTE_NUMBER_OFFSET is positive', () => {
    expect(QUOTE_NUMBER_OFFSET).toBeGreaterThan(0);
  });
});
