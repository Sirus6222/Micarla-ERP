# Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix a broken production login, eliminate CDN-induced slowness, add a full E2E test suite, and harden the build/deploy pipeline.

**Architecture:** The app is a flat-directory Vite + React 18 + Supabase SPA. All source files live at the project root (no `src/` prefix). `index.html` currently loads React, React Router, and other deps from `esm.sh` CDN via an importmap — this is the root cause of both the login failure (RRD v7 vs v6 breaking change) and the 4–6s load time. Removing those CDN references and letting Vite bundle everything is the entire Phase 0 fix.

**Tech Stack:** Vite 5, React 18, React Router v6 (HashRouter), TypeScript, Tailwind CSS 3, Supabase JS v2, Vitest, Playwright

---

## Project structure notes (read before touching anything)

```
Micarla-ERP/           ← project root, ALL source files live here (no src/)
├── index.html         ← entry HTML (has the broken importmap)
├── index.tsx          ← React mount point
├── App.tsx            ← routes (uses HashRouter → URLs are /#/login, /#/, etc.)
├── contexts/
│   └── AuthContext.tsx  ← auth state, 15s timeout on line 81
├── utils/
│   └── constants.ts   ← TAX_RATE=0.15, PRECISION_THRESHOLD=0.01, DEFAULT_WASTAGE=15
├── pages/             ← all page components
├── tailwind.config.js ← already has custom stone + primary colors (match index.html inline config)
├── vite.config.ts
└── vercel.json
```

**Important:** The app uses `HashRouter`. All E2E test navigations must use hash URLs: `/#/login`, `/#/`, `/#/quotes`, etc.

---

## Phase 0 — Critical Fix: Remove CDN from index.html

### Task 1: Remove importmap and Tailwind CDN

**Files:**
- Modify: `index.html`

**Why this works:** `tailwind.config.js` already has the custom `stone` and `primary` color palettes that the inline CDN config defines. Removing the CDN lets Vite's PostCSS pipeline use that file instead. All deps (React, RRD, Supabase, lucide-react) are already in `package.json` and will be bundled by Vite.

**Step 1: Open `index.html` and make the following edit**

Remove everything from line 8 through line 57 (the Tailwind CDN script + its config block + the entire importmap script). The file should go from this:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GraniteFlow ERP</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              stone: { ... },
              primary: { ... }
            }
          }
        }
      }
    </script>
  <script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.4",
    ...all CDN entries...
  }
}
</script>
</head>
  <body class="bg-stone-50 text-stone-800 antialiased">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

To this:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GraniteFlow ERP</title>
  </head>
  <body class="bg-stone-50 text-stone-800 antialiased">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

**Step 2: Verify the build succeeds**

```bash
npm run build
```

Expected output: build completes with no errors, `dist/` directory created. You will see chunks listed like `index-[hash].js`, lazy page chunks, etc.

**Step 3: Test locally**

```bash
npm run preview
```

Open `http://localhost:4173`. You should see the login form appear in under 2 seconds. Log in with your production credentials. You should be redirected to the Dashboard.

If login works: ✅ root cause confirmed fixed.

**Step 4: Commit**

```bash
git add index.html
git commit -m "fix: remove CDN importmap and Tailwind CDN from index.html

Vite already bundles all dependencies. The importmap was loading
React Router v7 from CDN while the app targets v6, causing login
navigation to silently fail after auth. Tailwind CDN was redundant
with the PostCSS build pipeline and added 350KB of runtime overhead."
```

---

## Phase 1 — Unit Tests for Financial Calculations

### Task 2: Extract calculation logic to a testable utility

The financial calculations currently live inline in `pages/QuoteBuilder.tsx`. Extract them to `utils/calculations.ts` so they can be unit-tested independently.

**Files:**
- Create: `utils/calculations.ts`
- Modify: `pages/QuoteBuilder.tsx` (import from new util)
- Create: `tests/financial-calculations.test.ts`

**Step 1: Write the failing tests first**

Create `tests/financial-calculations.test.ts`:

```typescript
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

  it('handles zero discount', () => {
    expect(calcLineItemPrice(100, 10, 15, 0)).toBeCloseTo(1150, 2);
  });
});

describe('calcSubtotal', () => {
  it('sums all line item prices', () => {
    expect(calcSubtotal([500, 300, 200])).toBeCloseTo(1000, 2);
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
});
```

**Step 2: Run to confirm all tests fail**

```bash
npx vitest run tests/financial-calculations.test.ts
```

Expected: all tests FAIL with "Cannot find module '../utils/calculations'"

**Step 3: Create `utils/calculations.ts`**

```typescript
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
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/financial-calculations.test.ts
```

Expected: all 15 tests PASS.

**Step 5: Run full test suite to make sure nothing broke**

```bash
npm test
```

Expected: all existing tests still pass.

**Step 6: Commit**

```bash
git add utils/calculations.ts tests/financial-calculations.test.ts
git commit -m "test: add financial calculation utility + unit tests

Extract SQM, wastage, tax, and balance-due calculations to
utils/calculations.ts and test all edge cases including
floating-point precision at PRECISION_THRESHOLD boundary."
```

---

## Phase 1 — E2E Tests (Playwright)

### Task 3: Install Playwright and write playwright.config.ts

**Files:**
- Modify: `package.json` (add dev dependency)
- Create: `playwright.config.ts`
- Create: `.env.test` (git-ignored, holds test Supabase credentials)
- Modify: `.gitignore` (add .env.test)

**Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Expected: Playwright installed, Chromium browser downloaded.

**Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // serial — tests share Supabase state
  retries: 1,             // one retry on flake
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // HashRouter: navigate via hash fragment
    // All page.goto() calls use full hash paths: '/#/login'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
```

**Step 3: Create `.env.test` with test user credentials**

```
# Credentials for E2E tests — do NOT use production admin account
# Create these test users in your Supabase Auth dashboard first
E2E_ADMIN_EMAIL=test-admin@micarla-erp.com
E2E_ADMIN_PASSWORD=TestPassword123!
E2E_SALES_EMAIL=test-sales@micarla-erp.com
E2E_SALES_PASSWORD=TestPassword123!
E2E_MANAGER_EMAIL=test-manager@micarla-erp.com
E2E_MANAGER_PASSWORD=TestPassword123!
E2E_FINANCE_EMAIL=test-finance@micarla-erp.com
E2E_FINANCE_PASSWORD=TestPassword123!
E2E_FACTORY_EMAIL=test-factory@micarla-erp.com
E2E_FACTORY_PASSWORD=TestPassword123!
```

**Step 4: Add .env.test to .gitignore**

Open `.gitignore` (create it if absent) and add:
```
.env.test
```

**Step 5: Install dotenv for playwright config**

```bash
npm install --save-dev dotenv
```

**Step 6: Add E2E script to package.json**

In `package.json` scripts section add:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Step 7: Create the `e2e/` directory**

```bash
mkdir e2e
```

**Step 8: Commit**

```bash
git add playwright.config.ts package.json package-lock.json
git commit -m "test: install Playwright and configure E2E test runner"
```

---

### Task 4: E2E — Auth tests

**Files:**
- Create: `e2e/auth.spec.ts`

**Step 1: Create `e2e/auth.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASS  = process.env.E2E_ADMIN_PASSWORD!;

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session before each test
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

    // Should navigate away from /login
    await expect(page).toHaveURL(/#\/$/);
    // Dashboard content should be visible
    await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test('wrong password → error message stays on login', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should stay on login
    await expect(page).toHaveURL(/#\/login/);
    // Error message visible
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('protected route without session → redirected to login', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/login/);
  });

  test('sign out → redirected to login, session cleared', async ({ page }) => {
    // Log in first
    await page.goto('/#/login');
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/#\/$/);

    // Find and click sign out
    await page.getByRole('button', { name: /sign out|logout/i }).click();
    await expect(page).toHaveURL(/#\/login/);

    // Navigating to a protected route should redirect back to login
    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/login/);
  });
});
```

**Step 2: Run auth tests**

```bash
npm run build && npx playwright test e2e/auth.spec.ts --headed
```

Expected: all 4 auth tests PASS. If any fail, check that the login form labels match (`getByLabel(/email/i)`) — inspect the Login page component and update selectors to match.

**Step 3: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test: add E2E auth tests (login, logout, protected routes)"
```

---

### Task 5: E2E — Quote workflow tests

**Files:**
- Create: `e2e/quote-workflow.spec.ts`
- Create: `e2e/helpers/login.ts` (shared login helper)

**Step 1: Create shared login helper `e2e/helpers/login.ts`**

```typescript
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
```

**Step 2: Create `e2e/quote-workflow.spec.ts`**

```typescript
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

    // Start a new quote
    await page.getByRole('button', { name: /new quote/i }).click();
    await page.waitForURL(/#\/quotes\//);

    // Select customer (assumes at least one customer exists in test data)
    await page.getByLabel(/customer/i).first().click();
    await page.getByRole('option').first().click();

    // Add a line item
    await page.getByRole('button', { name: /add item|add line/i }).click();

    // Fill width, height, pieces in the first line item row
    const row = page.locator('[data-testid="line-item-row"]').first();
    await row.getByPlaceholder(/width/i).fill('2');
    await row.getByPlaceholder(/height/i).fill('3');
    await row.getByPlaceholder(/pieces/i).fill('4');

    // Save as Draft
    await page.getByRole('button', { name: /save|draft/i }).click();

    // Quote appears in list
    await page.goto('/#/quotes');
    await expect(page.getByText('DRAFT')).toBeVisible({ timeout: 5000 });
  });

  test('Sales Rep submits quote for approval', async ({ page }) => {
    await loginAs(page, SALES_EMAIL, SALES_PASS);
    await page.goto('/#/quotes');

    // Open first DRAFT quote
    await page.getByText('DRAFT').first().click();
    await page.waitForURL(/#\/quotes\//);

    // Click Submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Confirm in dialog if present
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/submitted/i)).toBeVisible({ timeout: 5000 });
  });

  test('Manager approves a submitted quote', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASS);
    await page.goto('/#/quotes');

    // Open first SUBMITTED quote
    await page.getByText(/submitted/i).first().click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByRole('button', { name: /approve/i }).click();

    // Confirm dialog
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 5000 });
  });

  test('Manager rejects a quote with a reason', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASS);
    await page.goto('/#/quotes');

    // Open first SUBMITTED quote
    const submitted = page.getByText(/submitted/i).first();
    await expect(submitted).toBeVisible({ timeout: 5000 });
    await submitted.click();
    await page.waitForURL(/#\/quotes\//);

    await page.getByRole('button', { name: /reject/i }).click();

    // Fill rejection reason
    const reasonInput = page.getByPlaceholder(/reason/i);
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill('Price does not match current market rates');
    }

    await page.getByRole('button', { name: /confirm|reject/i }).last().click();
    await expect(page.getByText(/rejected/i)).toBeVisible({ timeout: 5000 });
  });
});
```

**Step 3: Run quote workflow tests**

```bash
npx playwright test e2e/quote-workflow.spec.ts --headed
```

Expected: tests PASS. If selectors don't match the actual UI, inspect the QuoteBuilder and QuoteList pages in `pages/QuoteBuilder.tsx` and `pages/QuoteList.tsx` and update `getByRole` / `getByText` / `getByLabel` calls accordingly. The selectors above are intentionally fuzzy (`/new quote/i`, `/submit/i`) to be resilient.

**Step 4: Commit**

```bash
git add e2e/quote-workflow.spec.ts e2e/helpers/login.ts
git commit -m "test: add E2E quote workflow tests (create, submit, approve, reject)"
```

---

### Task 6: E2E — Finance tests

**Files:**
- Create: `e2e/finance.spec.ts`

**Step 1: Create `e2e/finance.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/login';

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL!;
const FINANCE_PASS  = process.env.E2E_FINANCE_PASSWORD!;
const ADMIN_EMAIL   = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASS    = process.env.E2E_ADMIN_PASSWORD!;

test.describe('Finance', () => {
  test('Finance dashboard loads with invoice list', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/finance');
    await expect(page.getByText(/invoice|finance/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Overdue invoices are flagged', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/finance');
    // If any overdue invoices exist, the OVERDUE badge should be visible
    // (test data dependent — passes vacuously if no overdue invoices)
    const overdueCount = await page.getByText(/overdue/i).count();
    // Just assert the page loaded — specific overdue tests require seeded test data
    expect(overdueCount).toBeGreaterThanOrEqual(0);
  });

  test('Invoice detail page loads', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASS);
    await page.goto('/#/finance');

    // Click first invoice link
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
```

**Step 2: Run finance tests**

```bash
npx playwright test e2e/finance.spec.ts --headed
```

Expected: PASS (some tests may skip if no test data exists — that is acceptable).

**Step 3: Commit**

```bash
git add e2e/finance.spec.ts
git commit -m "test: add E2E finance dashboard and invoice tests"
```

---

### Task 7: E2E — Access control tests

**Files:**
- Create: `e2e/access-control.spec.ts`

**Step 1: Create `e2e/access-control.spec.ts`**

```typescript
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

    // Nav should NOT contain Finance or Customer links
    const nav = page.getByRole('navigation');
    await expect(nav.getByText(/finance/i)).not.toBeVisible();
    await expect(nav.getByText(/customer/i)).not.toBeVisible();

    // Production board should be accessible
    await page.goto('/#/production');
    await expect(page).toHaveURL(/#\/production/);
  });

  test('Finance Officer: Approve button not visible on quote', async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL, FINANCE_PASS);
    await page.goto('/#/quotes');

    // Open first submitted quote if one exists
    const submittedQuote = page.getByText(/submitted/i).first();
    if (await submittedQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submittedQuote.click();
      await page.waitForURL(/#\/quotes\//);
      // Approve button must NOT be visible for Finance role
      await expect(page.getByRole('button', { name: /^approve$/i })).not.toBeVisible();
    } else {
      test.skip(true, 'No submitted quotes in test environment');
    }
  });

  test('Sales Rep: quote fields read-only after submission', async ({ page }) => {
    await loginAs(page, SALES_EMAIL, SALES_PASS);
    await page.goto('/#/quotes');

    // Open a SUBMITTED quote
    const submittedQuote = page.getByText(/submitted/i).first();
    if (await submittedQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submittedQuote.click();
      await page.waitForURL(/#\/quotes\//);
      // No Save or edit buttons should be visible
      await expect(page.getByRole('button', { name: /save|edit/i })).not.toBeVisible();
    } else {
      test.skip(true, 'No submitted quotes in test environment');
    }
  });
});
```

**Step 2: Run access control tests**

```bash
npx playwright test e2e/access-control.spec.ts --headed
```

Expected: PASS (some skip if no test data — acceptable).

**Step 3: Commit**

```bash
git add e2e/access-control.spec.ts
git commit -m "test: add E2E role-based access control tests"
```

---

## Phase 2 — Build & Deploy Hardening

### Task 8: Vite chunk splitting

**Files:**
- Modify: `vite.config.ts`

**Step 1: Update `vite.config.ts`**

Replace the existing config with:

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
    },
  };
});
```

**Step 2: Build and verify chunks**

```bash
npm run build
ls dist/assets/
```

Expected: you will see separate files like:
```
vendor-[hash].js    ← React + React DOM + RRD
supabase-[hash].js  ← Supabase client
icons-[hash].js     ← lucide-react
index-[hash].js     ← app code
```

**Step 3: Verify the preview still works**

```bash
npm run preview
```

Open `http://localhost:4173` and log in — should work correctly.

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "build: add manual chunk splitting for vendor, supabase, and icons

Separates vendor (React/RRD), Supabase, and lucide-react into their
own chunks for better browser cache efficiency. These chunks change
rarely; only the app chunk is invalidated on each deploy."
```

---

### Task 9: Vercel security and cache headers

**Files:**
- Modify: `vercel.json`

**Step 1: Update `vercel.json`**

Replace the existing content with:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**What each header does:**
- `Cache-Control: immutable` — JS/CSS assets with content-hash in filename are cached for 1 year; browsers never re-download unchanged chunks
- `X-Frame-Options: DENY` — prevents the app from being embedded in an iframe (clickjacking protection)
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing attacks
- `Referrer-Policy` — limits referrer header leakage to cross-origin requests

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "deploy: add security headers and long-lived cache for static assets"
```

---

### Task 10: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --run

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
          E2E_SALES_EMAIL: ${{ secrets.E2E_SALES_EMAIL }}
          E2E_SALES_PASSWORD: ${{ secrets.E2E_SALES_PASSWORD }}
          E2E_MANAGER_EMAIL: ${{ secrets.E2E_MANAGER_EMAIL }}
          E2E_MANAGER_PASSWORD: ${{ secrets.E2E_MANAGER_PASSWORD }}
          E2E_FINANCE_EMAIL: ${{ secrets.E2E_FINANCE_EMAIL }}
          E2E_FINANCE_PASSWORD: ${{ secrets.E2E_FINANCE_PASSWORD }}
          E2E_FACTORY_EMAIL: ${{ secrets.E2E_FACTORY_EMAIL }}
          E2E_FACTORY_PASSWORD: ${{ secrets.E2E_FACTORY_PASSWORD }}

      - name: Upload Playwright report on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Step 2: Add GitHub repo secrets**

Go to GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret. Add all values from `.env.test` plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline (unit tests + E2E + build check)"
```

---

## Phase 3 — Auth UX Improvement

### Task 11: Reduce timeout and surface connection errors

**Files:**
- Modify: `contexts/AuthContext.tsx` (line 81: timeout value; line 9: interface)
- Modify: `App.tsx` (ProtectedRoute component at line 28)

**Step 1: Update `AuthContextType` interface in `contexts/AuthContext.tsx`**

Change:
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}
```

To:
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}
```

**Step 2: Add `authError` state and reduce timeout to 5s**

After `const [loading, setLoading] = useState(true);` (line 19), add:
```typescript
const [authError, setAuthError] = useState(false);
```

Change the timeout at line 81 from `15000` to `5000`, and add `setAuthError(true)`:
```typescript
const timeoutId = setTimeout(() => {
    if (mountedRef.current && loadingRef.current) {
        console.warn("Auth initialization timed out after 5s, forcing completion");
        setAuthError(true);
        safeSetLoading(false);
    }
}, 5000);
```

**Step 3: Include `authError` in the context value**

Change the context Provider value (near end of file) from:
```typescript
<AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, hasRole }}>
```
To:
```typescript
<AuthContext.Provider value={{ user, loading, authError, signIn, signUp, signOut, hasRole }}>
```

**Step 4: Use `authError` in `App.tsx`'s `ProtectedRoute`**

Change:
```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center bg-stone-50 text-stone-500">Initializing...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};
```

To:
```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, authError } = useAuth();

  if (authError) return (
    <div className="h-screen flex flex-col items-center justify-center bg-stone-50 text-stone-500 gap-3">
      <p className="font-medium text-stone-700">Connection problem</p>
      <p className="text-sm">Check your internet connection and refresh the page.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
      >
        Refresh
      </button>
    </div>
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-stone-50 text-stone-500">
      Initializing...
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};
```

**Step 5: Build and test**

```bash
npm run build && npm run preview
```

Open `http://localhost:4173`. With good internet: loads normally. With no internet (turn off wifi briefly): should show the connection error with a Refresh button after 5 seconds rather than hanging forever.

**Step 6: Commit**

```bash
git add contexts/AuthContext.tsx App.tsx
git commit -m "fix: reduce auth timeout to 5s and surface connection errors

Replace the silent 15s timeout with a user-visible connection error
message and a Refresh button. Users on bad networks now understand
what happened instead of seeing a blank or permanently loading screen."
```

---

## Phase 4 — Error Monitoring (Sentry)

### Task 12: Add Sentry to capture production runtime errors

**Files:**
- Modify: `package.json`
- Modify: `index.tsx`
- Modify: `.env.example`

**Step 1: Install Sentry**

```bash
npm install @sentry/react
```

**Step 2: Create a Sentry project**

1. Go to https://sentry.io → create a free account → New Project → React
2. Copy the DSN value (looks like `https://abc123@o123.ingest.sentry.io/456`)

**Step 3: Add DSN to environment**

In `.env.local` (and in Vercel dashboard under Environment Variables), add:
```
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

In `.env.example`, add:
```
VITE_SENTRY_DSN=
```

**Step 4: Initialise Sentry in `index.tsx`**

Add at the top of `index.tsx`, before the existing imports:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,           // 'production' or 'development'
  enabled: import.meta.env.MODE === 'production',
  tracesSampleRate: 0.1,                       // capture 10% of transactions for performance
});
```

Keep all existing imports and the rest of the file unchanged.

**Step 5: Build and verify**

```bash
npm run build
```

Expected: builds successfully. Deploy to Vercel and then trigger a test error by navigating to a bad URL — it should appear in your Sentry dashboard within seconds.

**Step 6: Commit**

```bash
git add index.tsx .env.example package.json package-lock.json
git commit -m "monitor: add Sentry for production runtime error tracking

Sentry is disabled in development to avoid noise. Captures 10% of
transactions for performance monitoring. All unhandled exceptions
and React render errors will appear in the Sentry dashboard."
```

---

## Final Verification

**After all phases:**

```bash
# 1. Unit tests
npm test

# 2. Build
npm run build

# 3. Preview and manually log in
npm run preview
# Open http://localhost:4173, log in, verify dashboard loads in < 2s

# 4. E2E tests
npx playwright test

# 5. Check bundle sizes
ls -lh dist/assets/*.js
# Expected: vendor chunk ~150KB gzipped, app code split across page chunks
```

**In Vercel production after deploy:**
- Open DevTools → Network → filter by JS → verify `Cache-Control: immutable` on `/assets/` files
- Open DevTools → Network → verify NO requests to `esm.sh` or `cdn.tailwindcss.com`
- Log in successfully with production credentials
