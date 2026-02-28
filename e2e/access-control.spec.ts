import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/login';

const FACTORY_EMAIL = process.env.E2E_FACTORY_EMAIL!;
const FACTORY_PASS  = process.env.E2E_FACTORY_PASSWORD!;
const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL!;
const FINANCE_PASS  = process.env.E2E_FINANCE_PASSWORD!;
const SALES_EMAIL   = process.env.E2E_SALES_EMAIL!;
const SALES_PASS    = process.env.E2E_SALES_PASSWORD!;

test.describe('Role-Based Access Control', () => {
  test('Factory Foreman: Finance and Customers not in nav', async ({ page }) => {
    await loginAs(page, FACTORY_EMAIL, FACTORY_PASS);

    const nav = page.getByRole('navigation');
    await expect(nav.getByText(/finance/i)).not.toBeVisible();
    await expect(nav.getByText(/customer/i)).not.toBeVisible();

    await page.goto('/#/production');
    await expect(page).toHaveURL(/#\/production/);
  });

  test('Finance Officer: Approve button not visible on quote', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/quotes');

    const submittedQuote = page.getByText(/submitted/i).first();
    if (await submittedQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submittedQuote.click();
      await page.waitForURL(/#\/quotes\//);
      await expect(page.getByRole('button', { name: /^approve$/i })).not.toBeVisible();
    } else {
      test.skip(true, 'No submitted quotes in test environment');
    }
  });

  test('Sales Rep: quote fields read-only after submission', async ({ page }) => {
    await loginAs(page, SALES_EMAIL, SALES_PASS);
    await page.goto('/#/quotes');

    const submittedQuote = page.getByText(/submitted/i).first();
    if (await submittedQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submittedQuote.click();
      await page.waitForURL(/#\/quotes\//);
      await expect(page.getByRole('button', { name: /save|edit/i })).not.toBeVisible();
    } else {
      test.skip(true, 'No submitted quotes in test environment');
    }
  });
});
