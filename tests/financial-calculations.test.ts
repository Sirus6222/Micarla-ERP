import { describe, it, expect } from 'vitest';
import {
  calcSqm,
  calcLineItemPrice,
  calcSubtotal,
  calcTax,
  calcGrandTotal,
  calcBalanceDue,
  isPaid,
} from '../utils/calculations';
import { TAX_RATE, PRECISION_THRESHOLD } from '../utils/constants';

describe('calcSqm', () => {
  it('multiplies width × height × pieces', () => {
    expect(calcSqm(2, 3, 4)).toBe(24);
  });

  it('returns 0 when any dimension is 0', () => {
    expect(calcSqm(0, 3, 4)).toBe(0);
    expect(calcSqm(2, 0, 4)).toBe(0);
    expect(calcSqm(2, 3, 0)).toBe(0);
  });

  it('handles fractional dimensions', () => {
    expect(calcSqm(1.5, 2, 1)).toBeCloseTo(3, 5);
  });

  it('returns a negative number for negative inputs (callers must guard upstream)', () => {
    // negative width produces a negative sqm — this documents the current behavior
    expect(calcSqm(-2, 3, 4)).toBeLessThan(0);
  });
});

describe('calcLineItemPrice', () => {
  it('applies wastage markup on top of base price', () => {
    // 100 sqm × 10 ETB/sqm = 1000, × (1 + 0.15 wastage) = 1150
    expect(calcLineItemPrice(100, 10, 15, 0)).toBeCloseTo(1150, 2);
  });

  it('applies discount after wastage', () => {
    // 1150 × (1 - 0.10 discount) = 1035
    expect(calcLineItemPrice(100, 10, 15, 10)).toBeCloseTo(1035, 2);
  });

  it('handles zero wastage', () => {
    expect(calcLineItemPrice(100, 10, 0, 0)).toBeCloseTo(1000, 2);
  });

  it('handles zero wastage and zero discount', () => {
    // 50 sqm × 20 ETB/sqm = 1000, no wastage, no discount
    expect(calcLineItemPrice(50, 20, 0, 0)).toBeCloseTo(1000, 2);
  });
});

describe('calcSubtotal', () => {
  it('sums all line item prices', () => {
    expect(calcSubtotal([500, 300, 200])).toBe(1000);
  });

  it('returns 0 for empty array', () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe('calcTax', () => {
  it(`applies ${TAX_RATE * 100}% tax rate`, () => {
    expect(calcTax(1000)).toBeCloseTo(150, 2);
  });

  it('returns 0 for zero subtotal', () => {
    expect(calcTax(0)).toBe(0);
  });
});

describe('calcGrandTotal', () => {
  it('adds subtotal and tax', () => {
    // subtotal 1000 + tax 150 = 1150
    expect(calcGrandTotal(1000)).toBeCloseTo(1150, 2);
  });
});

describe('calcBalanceDue', () => {
  it('subtracts paid amount from grand total', () => {
    expect(calcBalanceDue(1150, 500)).toBeCloseTo(650, 2);
  });

  it('returns 0 when fully paid', () => {
    expect(calcBalanceDue(1150, 1150)).toBeCloseTo(0, 2);
  });

  it('does not go negative (overpayment clamps to 0)', () => {
    expect(calcBalanceDue(1000, 1100)).toBe(0);
  });
});

describe('isPaid', () => {
  it('returns true when balance is within PRECISION_THRESHOLD', () => {
    expect(isPaid(1000, 999.995)).toBe(true);  // within 0.01
  });

  it('returns false when balance exceeds PRECISION_THRESHOLD', () => {
    expect(isPaid(1000, 980)).toBe(false);
  });

  it('handles floating-point imprecision: 0.1 + 0.2', () => {
    // 0.1 + 0.2 in JS = 0.30000000000000004 — isPaid should still treat as equal
    expect(isPaid(0.3, 0.1 + 0.2)).toBe(true);
  });

  it('returns true when balance is exactly PRECISION_THRESHOLD (boundary: <= means paid)', () => {
    // grandTotal=1000, amountPaid=999.99 → balance=0.01 = PRECISION_THRESHOLD exactly
    expect(isPaid(1000, 999.99)).toBe(true);
  });
});
