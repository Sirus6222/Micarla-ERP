import { describe, it, expect } from 'vitest';
import { validateEmail, validateProduct, validateCustomer } from '../utils/validation';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('a.b@test.co.et')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@no-user.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});

describe('validateProduct', () => {
  it('returns errors for missing required fields', () => {
    const errors = validateProduct({});
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some(e => e.field === 'name')).toBe(true);
    expect(errors.some(e => e.field === 'sku')).toBe(true);
  });

  it('returns no errors for valid product', () => {
    const errors = validateProduct({ name: 'Test', sku: 'TST-001', pricePerSqm: 100 });
    expect(errors).toHaveLength(0);
  });

  it('rejects negative price', () => {
    const errors = validateProduct({ name: 'Test', sku: 'TST-001', pricePerSqm: -50 });
    expect(errors.some(e => e.field === 'pricePerSqm')).toBe(true);
  });
});

describe('validateCustomer', () => {
  it('returns errors for missing required fields', () => {
    const errors = validateCustomer({});
    expect(errors.some(e => e.field === 'name')).toBe(true);
    expect(errors.some(e => e.field === 'phone')).toBe(true);
  });

  it('returns no errors for valid customer', () => {
    const errors = validateCustomer({ name: 'John', phone: '0911234567' });
    expect(errors).toHaveLength(0);
  });

  it('validates email format when provided', () => {
    const errors = validateCustomer({ name: 'John', phone: '0911234567', email: 'bad-email' });
    expect(errors.some(e => e.field === 'email')).toBe(true);
  });

  it('accepts valid email', () => {
    const errors = validateCustomer({ name: 'John', phone: '0911234567', email: 'john@test.com' });
    expect(errors).toHaveLength(0);
  });
});
