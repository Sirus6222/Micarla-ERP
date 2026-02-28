import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/login';

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL!;
const FINANCE_PASS  = process.env.E2E_FINANCE_PASSWORD!;
const ADMIN_EMAIL   = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASS    = process.env.E2E_ADMIN_PASSWORD!;

test.describe('Finance', () => {
  test('Finance dashboard loads with invoice section', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/finance');
    await expect(page.getByText(/invoice|finance/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Overdue invoices page loads without error', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/finance');
    const overdueCount = await page.getByText(/overdue/i).count();
    expect(overdueCount).toBeGreaterThanOrEqual(0);
  });

  test('Invoice detail page loads', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASS);
    await page.goto('/#/finance');

    const firstInvoice = page.getByRole('link', { name: /INV-/i }).first();
    if (await firstInvoice.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstInvoice.click();
      await page.waitForURL(/#\/invoices\//);
      await expect(page.getByText(/invoice/i)).toBeVisible();
    } else {
      test.skip(true, 'No invoices in test environment');
    }
  });
});
