import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/login';

const SALES_EMAIL   = process.env.E2E_SALES_EMAIL!;
const SALES_PASS    = process.env.E2E_SALES_PASSWORD!;
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL!;
const MANAGER_PASS  = process.env.E2E_MANAGER_PASSWORD!;

test.describe('Quote Workflow', () => {
  test('Sales Rep creates a quote in Draft', async ({ page }) => {
    await loginAs(page, SALES_EMAIL, SALES_PASS);
    await page.goto('/#/quotes');

    await page.getByRole('button', { name: /new quote/i }).click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByLabel(/customer/i).first().click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /add item|add line/i }).click();

    const row = page.locator('[data-testid="line-item-row"]').first();
    await row.getByPlaceholder(/width/i).fill('2');
    await row.getByPlaceholder(/height/i).fill('3');
    await row.getByPlaceholder(/pieces/i).fill('4');

    await page.getByRole('button', { name: /save|draft/i }).click();

    await page.goto('/#/quotes');
    await expect(page.getByText('DRAFT')).toBeVisible({ timeout: 5000 });
  });

  test('Sales Rep submits quote for approval', async ({ page }) => {
    await loginAs(page, SALES_EMAIL, SALES_PASS);
    await page.goto('/#/quotes');

    await page.getByText('DRAFT').first().click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByRole('button', { name: /submit/i }).click();

    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/submitted/i)).toBeVisible({ timeout: 5000 });
  });

  test('Manager approves a submitted quote', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASS);
    await page.goto('/#/quotes');

    await page.getByText(/submitted/i).first().click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByRole('button', { name: /approve/i }).click();

    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 5000 });
  });

  test('Manager rejects a quote with a reason', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASS);
    await page.goto('/#/quotes');

    const submitted = page.getByText(/submitted/i).first();
    await expect(submitted).toBeVisible({ timeout: 5000 });
    await submitted.click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByRole('button', { name: /reject/i }).click();

    const reasonInput = page.getByPlaceholder(/reason/i);
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill('Price does not match current market rates');
    }

    await page.getByRole('button', { name: /confirm|reject/i }).last().click();
    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 5000 });
  });
});
