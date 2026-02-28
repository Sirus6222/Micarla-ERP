import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASS  = process.env.E2E_ADMIN_PASSWORD!;

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/login');
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('graniteflow-auth') || k.startsWith('sb-')) {
          localStorage.removeItem(k);
        }
      });
    });
    await page.reload();
  });

  test('valid credentials → redirected to dashboard', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/#\/$/, { timeout: 10000 });
    await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test('wrong password → error message, stays on login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('protected route without session → redirected to login', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/login/);
  });

  test('sign out → session cleared, redirected to login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/#\/$/, { timeout: 10000 });

    await page.getByRole('button', { name: /sign out|logout/i }).click();
    await expect(page).toHaveURL(/#\/login/);

    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/login/);
  });
});
