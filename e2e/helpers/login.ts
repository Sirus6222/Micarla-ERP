import { Page } from '@playwright/test';

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/#/login');
  await page.evaluate(() => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('graniteflow-auth') || k.startsWith('sb-')) {
        localStorage.removeItem(k);
      }
    });
  });
  await page.reload();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/#\/$/, { timeout: 10000 });
}
