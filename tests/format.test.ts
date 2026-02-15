import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from '../utils/format';

describe('formatCurrency', () => {
  it('formats a number with 2 decimal places by default', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('0.00');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1000000)).toBe('1,000,000.00');
  });

  it('supports custom decimal places', () => {
    expect(formatCurrency(1234.5678, 0)).toBe('1,235');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
