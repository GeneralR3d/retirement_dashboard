# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server at http://localhost:3000
- `npm run build` — production build (also runs TypeScript checking)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (uses `eslint-config-next`)
- `npx tsc --noEmit` — typecheck without building

There is no test suite.

## Architecture

Single-page Next.js 16 (App Router) dashboard for modeling Singapore retirement scenarios. Tailwind v4, React 19, recharts for visualization.

- **`lib/tax.ts`** is the model. `calculateTax(income)` implements IRAS resident tax brackets. `buildProjection(inputs)` is the core engine: it walks N years, computes salary growth, two parallel tax outcomes (with vs without a `15300` SRS contribution), the resulting amounts invested in each scenario, and compounds two pots at the investment growth rate. The SRS scenario tracks `srsPot` and `brokeragePotWithSrs` separately on each `YearRow` (their sum is `potWithSrs`) so the withdrawal phase can act on the SRS portion alone. `calculateSrsWithdrawal(srsPot)` models the post-accumulation drawdown: split equally over `SRS_WITHDRAWAL_YEARS` (10), tax `SRS_TAXABLE_FRACTION` (50%) of each yearly withdrawal through the same bracket function, return `netFromSrs`. All money math lives here — the page is a pure view over what these functions return.
- **`app/page.tsx`** is a client component (`"use client"`). It owns the input state (salary, growth rates, living-expense %, years), memoizes a call to `buildProjection`, and renders KPI cards, a recharts `LineChart`, and the annual table. The dark/light toggle (`useTheme`) writes a `dark` class on `<html>` and persists to `localStorage`. All UI primitives (`Slider`, `StatCard`, `Stat`, `Th`, `Td`) are defined inline in this file — there is no separate components directory.
- **`app/layout.tsx`** sets `className="dark"` on `<html>` for SSR so the first paint matches the default theme; `suppressHydrationWarning` is required because `useTheme` may flip the class on mount.
- **`app/globals.css`** uses Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` so the `dark:` variant follows the class toggle rather than `prefers-color-scheme`.
- **`taxAmount.js`** is the original CLI prototype the tax brackets were ported from. Not imported by the app — keep `lib/tax.ts` as the source of truth.

### SRS modeling convention

For a given year:
- `tax_no_srs   = calculateTax(salary)`
- `tax_with_srs = calculateTax(salary - 15300)`
- Without SRS: invested = `salary − tax_no_srs − livingExpenses`
- With SRS: invested = `15300` (into SRS) + `(salary − 15300 − tax_with_srs − livingExpenses)` (into brokerage)
- Living expenses are a `%` of **pre-tax** salary (same in both scenarios — that's the whole point of the comparison).
- Each pot grows as `pot = (pot + invested) * (1 + r)` per year (contribution at start of year).
- Withdrawal phase assumes no further investment growth on the SRS pot during drawdown and no other income (so each year's taxable 50% is taxed standalone through the resident brackets). Final take-home with SRS = `brokeragePotWithSrs + netFromSrs`.

`ProjectionInputs.srsCap` defaults to `SRS_ANNUAL_CAP` (15300) but can be overridden. `calculateSrsWithdrawal` similarly accepts an optional `years` override (defaults to `SRS_WITHDRAWAL_YEARS` = 10).

When extending the model (CPF, additional reliefs, growth during drawdown, retirement-phase income), add to `buildProjection` / `calculateSrsWithdrawal` and extend `YearRow` rather than computing in the component.

## Next.js 16 note

Per `AGENTS.md`, this Next.js version has breaking changes vs. older training data. Consult `node_modules/next/dist/docs/` before changing routing, config, or build setup.
