# Micarla ERP — Production Readiness Design

**Date:** 2026-02-28
**Status:** Approved

---

## Problem Statement

The production Vercel deployment has two symptoms:
1. **Login fails** — the form appears, credentials are entered, but login does not complete
2. **Slow / clunky** — initial page load takes 4–6 seconds before anything is interactive

Both symptoms share a single root cause in `index.html`.

---

## Root Cause

### Bug 1: Importmap overriding Vite bundles with CDN packages

`index.html` declares an importmap that loads core dependencies from `esm.sh` at runtime:

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.4",
    "react-dom/": "https://esm.sh/react-dom@^19.2.4/",
    "react-router-dom": "https://esm.sh/react-router-dom@^7.13.0",
    "lucide-react": "https://esm.sh/lucide-react@^0.563.0",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@^2.93.3"
  }
}
</script>
```

**Why login breaks:** The importmap loads React Router **v7** from CDN. The application is
written against React Router **v6** (`package.json: ^6.22.1`). These are breaking major
versions — `useNavigate`, `<Route>`, and `<Navigate>` behave differently in v7. After a
successful `signInWithPassword` call, the post-login navigation fails silently.

**Why performance is poor:** The browser makes 5 separate network round-trips to `esm.sh`
before rendering anything. Each round-trip adds 100–500ms. Combined with a cold CDN edge,
this results in 4–6 seconds before the login screen appears.

**Why it conflicts with Vite:** Vite already bundles all of these packages into optimised
chunks. The importmap then overrides those chunks with CDN versions, resulting in two
instances of React and React Router running simultaneously — violating React's rules.

### Bug 2: Tailwind CSS loaded from CDN at runtime

```html
<script src="https://cdn.tailwindcss.com"></script>
```

The full Tailwind runtime engine (~350KB) is fetched from CDN on every page load.
Vite + PostCSS already produces a purged, minified Tailwind stylesheet during `vite build`.
This tag is redundant, conflicts with the built stylesheet, and adds ~350KB of network cost.

**The fix for both:** Delete these two blocks from `index.html`. Vite handles everything.

---

## Design

### Phase 0 — Critical Fix (unblocks login immediately)

**File:** `index.html`

Remove:
- `<script src="https://cdn.tailwindcss.com"></script>`
- The entire `<script type="importmap">` block

No other files need to change. Vite's existing build configuration already bundles and
optimises all dependencies referenced in package.json.

**Expected outcome:** Login works. Initial load drops to <1.5s.

---

### Phase 1 — End-to-End Test Suite

**Framework:** Playwright (`@playwright/test`)
**Environment:** Dedicated Supabase test project (separate from production)
**CI integration:** Tests run before every Vercel deploy (Phase 2)

#### Test suites

**`e2e/auth.spec.ts`**
- Login with valid credentials → redirected to Dashboard
- Login with wrong password → error message shown, stays on login
- Navigate to protected route without session → redirected to `/login`
- Sign out → session cleared, redirected to `/login`

**`e2e/quote-workflow.spec.ts`** — primary business flow
- Sales Rep creates quote with 3 line items, verifies calculated totals
- Sales Rep submits quote → status SUBMITTED
- Manager approves quote → status APPROVED
- Manager rejects quote with reason → status REJECTED, reason in audit trail
- Approved quote converted to order → order number assigned

**`e2e/finance.spec.ts`**
- Create deposit invoice for an order → correct amount (50% of total)
- Record partial payment → status PARTIALLY_PAID, amountPaid updated
- Record final payment → status PAID
- Overdue invoice detection → appears in overdue list

**`e2e/inventory.spec.ts`**
- Create product with stock level → appears in product list
- Set stock below reorder point → warning indicator visible
- Complete production order → product stock decremented by order quantity

**`e2e/access-control.spec.ts`**
- Factory Foreman: no Finance or Customer nav items visible
- Finance Officer: Approve button absent on quote detail
- Sales Rep: quote fields read-only after submission

#### Unit tests (Vitest — extends existing)

**`tests/financial-calculations.test.ts`** (new)
- SQM: `width × height × pieces`
- Wastage: `price × (1 + wastagePercent / 100)`
- Tax: `taxableAmount × 0.15`
- Balance due: `grandTotal − totalPaid`
- Floating-point edge cases at the `PRECISION_THRESHOLD = 0.01` boundary

---

### Phase 2 — Build & Deploy Hardening

#### Vite config (`vite.config.ts`)
Add manual chunk splitting to improve cache efficiency:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        supabase: ['@supabase/supabase-js'],
        icons: ['lucide-react'],
      }
    }
  },
  sourcemap: false,   // smaller production bundle
}
```
Vendor chunk changes rarely → long-lived browser cache. App chunk changes on each deploy.

#### Vercel config (`vercel.json`)
Add security and caching headers alongside the existing SPA rewrite:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
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
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

#### CI/CD (`.github/workflows/deploy.yml`)
Gate every Vercel deploy behind tests:
```
push to main →
  npm ci →
  npm test →         (Vitest unit tests)
  playwright test →  (E2E against test Supabase project)
  → Vercel deploys
```
Currently: any push deploys immediately with no test gate.

---

### Phase 3 — Auth UX Improvement

**File:** `src/contexts/AuthContext.tsx`
- Reduce safety timeout from 15s → 5s (15s is unnecessarily long)
- Expose an `authError` boolean from the context

**File:** `src/App.tsx`
- If auth times out, show: *"Connection problem. Please check your internet and refresh."*
- Currently: times out silently, showing nothing or a blank login screen

---

### Phase 4 — Error Monitoring

Add Sentry (free tier) for runtime error visibility in production.

**Files:**
- `package.json` → add `@sentry/react`
- `src/main.tsx` → `Sentry.init({ dsn: '...', environment: 'production' })`

Currently: all runtime errors are `console.error` only, invisible to the developer after
deployment. Sentry captures unhandled exceptions, React render errors, and slow transactions.

---

## File Change Summary

| File | Change | Phase |
|------|--------|-------|
| `index.html` | Remove importmap + Tailwind CDN | 0 — CRITICAL |
| `playwright.config.ts` | New — Playwright setup | 1 |
| `e2e/auth.spec.ts` | New | 1 |
| `e2e/quote-workflow.spec.ts` | New | 1 |
| `e2e/finance.spec.ts` | New | 1 |
| `e2e/inventory.spec.ts` | New | 1 |
| `e2e/access-control.spec.ts` | New | 1 |
| `tests/financial-calculations.test.ts` | New | 1 |
| `vite.config.ts` | Add chunk splitting, disable sourcemap | 2 |
| `vercel.json` | Add security + cache headers | 2 |
| `.github/workflows/deploy.yml` | New — CI/CD pipeline | 2 |
| `src/contexts/AuthContext.tsx` | Reduce timeout, expose authError | 3 |
| `src/App.tsx` | Auth error UI | 3 |
| `src/main.tsx` | Sentry init | 4 |

---

## Verification

**After Phase 0:**
```bash
npm run build
npm run preview
# Open http://localhost:4173 — log in with production credentials — should work immediately
```

**After Phase 1:**
```bash
npm test                    # all unit tests pass
npx playwright test         # all E2E suites pass
```

**After Phase 2:**
```bash
npm run build
# Check dist/assets/ — should see vendor.js, supabase.js, icons.js as separate chunks
# Open Network tab — /assets/*.js files served with Cache-Control: immutable
```

---

## Out of Scope

- Telegram integration
- PDF export
- Bulk CSV import
- New ERP modules (HR, procurement, supplier management)
