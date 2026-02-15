export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const MAX_STRING_LENGTH = 500;

const sanitizeString = (value: string): string => {
  return value.trim().slice(0, MAX_STRING_LENGTH);
};

export const validateProduct = (product: {
  name?: string;
  sku?: string;
  pricePerSqm?: number;
}): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!product.name?.trim()) errors.push({ field: 'name', message: 'Product name is required' });
  if (!product.sku?.trim()) errors.push({ field: 'sku', message: 'SKU is required' });
  if (product.pricePerSqm != null && product.pricePerSqm < 0) {
    errors.push({ field: 'pricePerSqm', message: 'Price must be non-negative' });
  }
  return errors;
};

export const validateCustomer = (customer: {
  name?: string;
  phone?: string;
  email?: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!customer.name?.trim()) errors.push({ field: 'name', message: 'Customer name is required' });
  if (!customer.phone?.trim()) errors.push({ field: 'phone', message: 'Phone number is required' });
  if (customer.email && !validateEmail(customer.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }
  return errors;
};

export const sanitizeInput = (input: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    sanitized[key] = typeof value === 'string' ? sanitizeString(value) : value;
  }
  return sanitized;
};
