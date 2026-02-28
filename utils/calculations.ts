import { TAX_RATE, PRECISION_THRESHOLD } from './constants';

/** Total square metres for a line item: width (m) × height (m) × pieces */
export function calcSqm(width: number, height: number, pieces: number): number {
  return width * height * pieces;
}

/**
 * Price for a single line item after wastage markup and discount.
 * @param sqm - total square metres
 * @param pricePerSqm - price per m²
 * @param wastagePercent - wastage % (e.g. 15 means 15%)
 * @param discountPercent - discount % applied after wastage (e.g. 10 means 10%)
 */
export function calcLineItemPrice(
  sqm: number,
  pricePerSqm: number,
  wastagePercent: number,
  discountPercent: number,
): number {
  const base = sqm * pricePerSqm;
  const withWastage = base * (1 + wastagePercent / 100);
  const withDiscount = withWastage * (1 - discountPercent / 100);
  return withDiscount;
}

/** Sum of all line item prices */
export function calcSubtotal(lineItemPrices: number[]): number {
  return lineItemPrices.reduce((sum, p) => sum + p, 0);
}

/** Tax amount: subtotal × TAX_RATE (15%) */
export function calcTax(subtotal: number): number {
  return subtotal * TAX_RATE;
}

/** Grand total: subtotal + tax */
export function calcGrandTotal(subtotal: number): number {
  return subtotal + calcTax(subtotal);
}

/** Balance remaining: grandTotal − amountPaid, clamped to 0 */
export function calcBalanceDue(grandTotal: number, amountPaid: number): number {
  return Math.max(0, grandTotal - amountPaid);
}

/** True when the remaining balance is within PRECISION_THRESHOLD (0.01) */
export function isPaid(grandTotal: number, amountPaid: number): boolean {
  return calcBalanceDue(grandTotal, amountPaid) <= PRECISION_THRESHOLD;
}
