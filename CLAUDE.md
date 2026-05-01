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

If you see a hydration mismatch after changing component text, run `rm -rf .next && npm run dev` to clear the build cache.

## Architecture

Multi-page Next.js 16 (App Router) dashboard for modeling Singapore retirement scenarios. Tailwind v4, React 19, recharts for visualization.

### Shared state

**`lib/profile-context.tsx`** — `ProfileProvider` + `useProfile` hook. Holds all user inputs and persists them to `localStorage`. The provider is mounted in `app/layout.tsx` so every page shares the same source of truth. Default values live in the `DEFAULTS` constant. Also exports `CPF_RATES` (OA 2.5%, SA/MA/RA 4%); the same values are exported as individual constants from `lib/tax.ts` (`CPF_OA_RATE` etc.) for use in financial logic.

`ProfileInputs` fields:
- Age milestones: `currentAge` (25), `stopWorkingAge` (55), `cpfWithdrawalAge` (65), `cpfRetirementAge` (55), `srsWithdrawalAge` (63), `deathAge` (83)
- Financial inputs: `startingSalary`, `salaryGrowthRate`, `investmentGrowthRate` (0.07), `investmentGrowthRateRetirement` (0.025), `livingExpensePct` (used only by the standalone `/srs` demo page via `buildProjection`; all other pages use `monthlyExpenseSeries` instead).
- CPF starting balances: `cpfOA`, `cpfSA`, `cpfMA`, `cpfRA`
- CPF LIFE: `cpfLifeFrs` (200000), `cpfLifeMonthlyPayout` (1610)
- Salary override series: `salarySeries: number[]` — per-year gross salary array, length = `stopWorkingAge - currentAge`. Empty `[]` means "use formula". The config page always keeps it in sync; when `startingSalary`, `salaryGrowthRate`, `currentAge`, or `stopWorkingAge` change, the series is regenerated.
- `startingCash` (5000) — brokerage seed balance. **Derived** from `investments` in the config page; do not edit directly.
- `investmentGrowthRate` (0.07) — pre-retirement investment growth rate. **Derived** as the weighted average of `investments` in the config page; do not edit directly.
- `monthlyExpensesToday` (4000) — base monthly expenses in today's money. Used by the retirement page directly (`* 12 * inflation^k`) and as the seed value for `monthlyExpenseSeries`.
- `monthlyExpenseSeries: number[]` — per-year monthly spend during working years (today's money), length = `stopWorkingAge - currentAge`. Empty `[]` means "use `monthlyExpensesToday` flat". Inflation is applied at consumption time (`* (1+EXPENSES_INFLATION_RATE)^i`), not stored in the series.
- `investments: Investment[]` — breakdown of real networth by asset class. Each entry: `{ id, name, value, returnRate }`. The config page recomputes `startingCash` (sum) and `investmentGrowthRate` (value-weighted average return) whenever this changes.
- `cash` (10000) — zero-interest cash account balance. Tracked separately from `startingCash`; sized via the emergency-fund rule. Held flat post-`stopWorkingAge`.
- `emergencyMonths` (6) — months of expenses to keep as cash. The accumulation engine targets `monthly * emergencyMonths * inflation^i` each year.
- `lumpsumExpenses: LumpsumExpense[]`, `lumpsumInflows: LumpsumExpense[]` — one-time amounts at a specific age (`{ id, age, name, amount }`). Edited on `/config` *and* `/accumulation` (accumulation page uses a local-draft + Recalculate button to commit).
- `srsAnnualCap` (15300) — annual SRS contribution cap.
- `srsAccepted: boolean[]` — per-working-year SRS accept/reject decisions. Length = `workingYears`; missing indices default to `true`. Persisted to localStorage and shared across all pages so the accumulation table, networth SRS chart, and retirement page all reflect the same choices. Empty `[]` means all years accepted.

`investmentGrowthRateRetirement` represents reduced risk tolerance after stopping work. `buildProjection` uses `investmentGrowthRate` for `i < workingYears` and switches to `investmentGrowthRateRetirement` for all subsequent years.

### Pages

- **`app/page.tsx`** — server-side redirect to `/main`.
- **`app/main/page.tsx`** — Overview page. **Four chart sections:** (1) Net Worth Breakdown — `LineChart` with five lines (Total, Investments, SRS Pot, CPF, Cash) from `currentAge` to `deathAge`, preceded by 4 KPI cards. (2) SRS Account — `AreaChart` of SRS pot with KPI cards (pot at withdrawal age, yearly withdrawal, tax/yr, yearly after tax). (3) Cash Reserve — `AreaChart` of cash balance with 2 KPI cards. (4) Investment Account — `AreaChart` of brokerage balance. All data is computed in a single `useMemo`: `buildAccumulation` (with `srsTopUps` derived from `srsAccepted`) → SRS pot accumulated manually from `accRows[i].srsTopUp` → `buildCpfProjection` → `buildBrokerageProjection` (with `contributions = accRows.map(r => r.invested)`). The SRS pot by age is computed by iterating `(pot + srsTopUp) * (1 + growthRate)` over working years, then growing at `investmentGrowthRateRetirement` until `srsWithdrawalAge`, then drawing down linearly. Y axis domain for the networth chart is explicitly set to peak total × 1.1 (rounded to nearest $500k) because recharts cannot auto-scale a multi-series domain. `runOutRow` and `canRetire` drive the green/red verdict banner.
- **`app/config/page.tsx`** — profile inputs page. Uses a **local draft pattern**: all field changes update a local `draft` state; `setInputs` (which writes to context + `localStorage`) is only called when the user clicks **Recalculate**. An "Unsaved changes" badge appears when draft differs from saved inputs. Layout: left column (Personal Details + Retirement Settings), right column (CPF balances + milestones), full-width investments table, side-by-side lumpsum tables. Cascade rules: salary table edits at index `i` propagate as `parsed * (1+salaryGrowthRate)^(j-i)` to rows below. Monthly-expenses table edits propagate flat (today's money), since inflation is applied at consumption.
- **`app/srs/page.tsx`** — SRS demo page. **Fully standalone — does not read from `useProfile`.** All inputs are local `useState` values. Always uses `buildProjection` with `livingExpensePct`-based expenses. Renders demo parameter controls, KPI cards, a pot-growth `LineChart`, a brokerage `AreaChart`, an annual projection table with hideable columns, and an SRS withdrawal breakdown. The disclaimer banner explains the disconnection from the rest of the app.
- **`app/cpf/page.tsx`** — CPF projection page. Passes `endAge: deathAge` to `buildCpfProjection`. Renders 3 KPI cards, a stacked `AreaChart` with OA/SA/MA/RA areas. OA is zeroed in the chart from `cpfRetirementAge` onwards. Two dotted `ReferenceLine`s at `cpfRetirementAge` (violet) and `cpfWithdrawalAge` (orange). Column visibility pattern (same as `/srs`): `hiddenCols: Set<ColId>` + `showHidden` toggle; default hidden = all four balance columns.
- **`app/accumulation/page.tsx`** — Working-years accumulation page (`currentAge` to `stopWorkingAge`). Calls `buildAccumulation` from `lib/cash-flow.ts`. Lumpsum tables use **local-draft + Recalculate** pattern (mirrors config). Annual table columns: age (with "⚠ Debt Alert!" when brokerage insolvent), take-home (with inflow chip), **SRS top-up** (per-row ✓/✗ toggle), tax, living expenses, cash on hand (actual / target), cash topup, investments topup. **SRS top-up column:** `recommendations` memo computes `recommendedSrsTopUp(takeHome, SRS_ANNUAL_CAP)` from salary alone. `srsTopUps` memo maps accepted rows to their `topUp` (or 0 if declined). Toggling a row calls `setInputs({ ...inputs, srsAccepted: updatedArray })` immediately — no Recalculate needed. This instantly cascades to the table and updates the networth/retirement pages when the user navigates to them.
- **`app/retirement/page.tsx`** — Retirement spending page. **SRS Withdrawal summary section** (5 `StatCard`s): SRS pot at `srsWithdrawalAge`, yearly gross withdrawal ×10, tax per year (50% of withdrawal is taxable), total from SRS after tax, yearly withdrawal after tax. Calls `calculateSrsWithdrawal` for these values. Then the annual expenses table (`stopWorkingAge` to `deathAge`) with columns: age, years from now, monthly/annual expenses, CPF LIFE income, SRS income, withdrawal from investments, investments balance, shortfall. `buildWithdrawalRows` (local) produces `srsIncome` from `srsAnnualIncome`. `buildBrokerageProjection` populates brokerage income and balance. **Balance convention:** the "Investments balance" column at age `a` shows `brokerageRows[k-1].balance` (balance entering that year), while flows come from `brokerageRows[k]` (what happens during that year). Shortfall column: green surplus (+), red uncovered gap (−).

### Shared library

- **`lib/tax.ts`** — all money math. Pages are pure views — no financial logic in components. Key exports:
  - `calculateTax(income)` — IRAS resident tax brackets
  - `buildProjection(inputs)` — SRS/brokerage projection engine. Used only by the standalone `/srs` demo page. The main/retirement/accumulation pages do not use this — they derive the SRS pot directly from `buildAccumulation` rows.
  - `buildCpfProjection(inputs)` — CPF account projection engine. Optional `endAge` overrides `cpfWithdrawalAge` as the projection endpoint.
  - `buildBrokerageProjection(inputs)` — investments account projection engine. Takes `contributions: number[]` (one entry per working year, SRS already deducted) instead of `srsRows`. Returns `BrokerageRow[]` where each row has `age`, `balance`, `brokerageIncome`, `srsReinvestment`. SRS is always active (no `srsEnabled` flag); drawdown phase covers `stopWorkingAge` to `srsWithdrawalAge`, reinvestment phase covers `srsWithdrawalAge` onward.
  - `recommendedSrsTopUp(income, maxTopUp)` — returns `{ topUp, taxSavings }`: the minimum top-up that drops `income` into the next-lower tax bracket, capped at `maxTopUp`. Returns `{ topUp: 0, taxSavings: 0 }` when already in the 0% bracket or the required amount exceeds `maxTopUp`.
  - `calculateSrsWithdrawal(srsPot, years?)` — returns `{ srsPot, yearlyWithdrawal, taxablePerYear, taxPerYear, totalTax, netFromSrs }`. Only 50% of each withdrawal (`SRS_TAXABLE_FRACTION`) is taxable.
  - `allocateCpfContribution(age, contribution)` — splits CPF contribution into `{ oa, sa, ma }`. Currently covers ages ≤55; a `TODO` marks where above-55 bands should be added.
  - Expense constants: `EXPENSES_INFLATION_RATE` (0.02), `MONTHLY_EXPENSES_TODAY` / `ANNUAL_EXPENSES_TODAY` — dollar constants superseded by `monthlyExpensesToday` from context, but `EXPENSES_INFLATION_RATE` is still imported by pages.
  - SRS constants: `SRS_ANNUAL_CAP` (15300), `CPF_EMPLOYEE_RATE` (0.2), `SRS_WITHDRAWAL_YEARS` (10), `SRS_TAXABLE_FRACTION` (0.5)
  - CPF constants: `CPF_OA_RATE` (0.025), `CPF_SA_RATE` (0.04), `CPF_MA_RATE` (0.04), `CPF_RA_RATE` (0.04), `CPF_TOTAL_CONTRIBUTION_RATE` (0.37), `CPF_FRS_INFLATION_RATE` (0.02)
- **`lib/cash-flow.ts`** — `buildAccumulation(inputs)` returns one `AccumulationRow` per working year (`age = currentAge + i`). The optional `srsTopUps: number[]` parameter drives per-year SRS deductions; when omitted, no SRS top-up is applied. Used by `/accumulation`, `/main`, and `/retirement`. See "Cash + accumulation modeling convention" below.
- **`lib/format.ts`** — `fmt` and `fmtMoney` helpers (en-SG locale).
- **`taxAmount.js`** — original CLI prototype, not imported. Keep `lib/tax.ts` as the source of truth.

### Shared UI

**`app/components/ui.tsx`** — `Slider`, `NumberField`, `StatCard`, `Stat`, `Th`, `Td`, `InfoTooltip`. Import from here rather than redefining per page.

**`InfoTooltip`** — hover tooltip that renders via `createPortal` into `document.body`. Use this (not CSS `position: absolute`) whenever a tooltip is inside an `overflow-x-auto` container, because `overflow` clips absolutely-positioned descendants regardless of `z-index`. On `mouseEnter` it reads the icon's `getBoundingClientRect()` and positions the portal with `position: absolute` in page coordinates. A 100 ms hide delay lets the mouse travel from icon to tooltip without it disappearing, making links inside the tooltip clickable.

**`app/components/lumpsum-table.tsx`** — `LumpsumTable` editor for `LumpsumExpense[]` (used for both inflows and expenses). Props: `title`, `description`, `rows`, `onChange`, `totalAccent: "red" | "emerald"`, `idPrefix`. Purely controlled — owns no state. Used in `/config` (bound to draft state) and `/accumulation` (bound to local draft, committed on Recalculate).

**`app/components/navbar.tsx`** — sticky nav. Links split into `NAV_LINKS_BEFORE` (Config, Networth) and `NAV_LINKS_AFTER` (CPF, SRS Demo), with `SplitNavButton` between them. Also owns `useTheme`, which toggles a `dark` class on `<html>` and persists to `localStorage`.

**`components/ui/button.tsx`** — `SplitNavButton`. Three-state nav button tracking mouse X position relative to its centre. Default "Cashflow" (routes to `/cashflow`, currently unbuilt); hover-left "Accumulation" (`/accumulation`); hover-right "Retirement" (`/retirement`). Uses `cn()` from `lib/utils.ts`.

### Theme

`app/layout.tsx` sets `className="dark"` on `<html>` for SSR first-paint; `suppressHydrationWarning` is required because `useTheme` may flip it on mount. `app/globals.css` uses Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` follows the class toggle, not `prefers-color-scheme`. Chart axis/grid/tooltip colours are CSS custom properties (`--axis-color`, `--grid-color`, `--tooltip-bg`) defined per theme in `globals.css` and referenced by string in the recharts config.

### SRS modeling convention (main/retirement/accumulation)

These pages do **not** use `buildProjection`. The SRS pot is computed directly from `buildAccumulation` rows:

1. Call `buildAccumulation` with `srsTopUps[i] = srsAccepted[i] ? recommendedSrsTopUp(takeHome, srsAnnualCap).topUp : 0` for each working year `i`.
2. Accumulate SRS pot: `srsPot = (srsPot + accRows[i].srsTopUp) * (1 + investmentGrowthRate)` for each working year.
3. After `stopWorkingAge`, grow at `investmentGrowthRateRetirement` until `srsWithdrawalAge` (no new contributions).
4. `srsAnnualIncome = calculateSrsWithdrawal(srsPotAtWithdrawalAge).netFromSrs / SRS_WITHDRAWAL_YEARS`.
5. Pass `contributions = accRows.map(r => r.invested)` to `buildBrokerageProjection`. Since `buildAccumulation` already deducts the SRS top-up from `invested`, no further subtraction is needed.

**Age labeling:** `accRows[i].age = currentAge + i`. The SRS pot balance at the end of year `i` is plotted at `currentAge + i + 1` in the net worth chart (end-of-year convention), but the annual contribution shown in the SRS chart tooltip is tagged at `currentAge + i` (same age as the accumulation table row) to keep labels consistent.

### SRS modeling convention (SRS demo page only)

`buildProjection` is used exclusively by `/srs`. For a given year index `i`:
- `salary = salarySeries[i]` when available, otherwise `startingSalary * (1 + salaryGrowthRate)^i`
- `takeHome = salary * (1 - CPF_EMPLOYEE_RATE)`
- `livingExpenses = takeHome * livingExpensePct`
- `srsContribution = min(SRS_ANNUAL_CAP, takeHome)`
- `taxNoSrs = calculateTax(takeHome)`; `taxWithSrs = calculateTax(takeHome - srsContribution)`
- Without SRS: `investedNoSrs = takeHome - taxNoSrs - livingExpenses`
- With SRS: `brokerageWithSrs = takeHome - srsContribution - taxWithSrs - livingExpenses`
- Each pot grows as `pot = (pot + invested) * (1 + growthRate)` per year.

### CPF modeling convention

`buildCpfProjection` uses `CPF_TOTAL_CONTRIBUTION_RATE` (37% of gross salary, employee + employer). For year index `i`:
- `totalContribution = salary * 0.37`
- `allocateCpfContribution(currentAge + i, totalContribution)` produces `{ oa, sa, ma }`
- Each account grows as `balance = (balance + contribution) * (1 + rate)` per year

**SA→RA conversion** at `cpfRetirementAge` (default 55):
- `raTarget = cpfLifeFrs * (1 + CPF_FRS_INFLATION_RATE)^(cpfRetirementAge - currentAge)`
- SA balance fills RA to `raTarget`; surplus/deficit flows through OA. SA = 0 thereafter.
- `CpfYearRow.raConversionHappened = true` on that row; SA contributions redirect to OA after this.
- The full OA balance transfers to the investments account at the same event.

**CPF LIFE annuity purchase** at `cpfWithdrawalAge` (default 65):
- Full RA balance recorded as `CpfYearRow.cpfLifePremium`; RA set to 0.
- Annual payout = `cpfLifeMonthlyPayout * 12 * (1 + CPF_FRS_INFLATION_RATE)^(cpfWithdrawalAge - currentAge)` — computed in the page, fixed thereafter.

### Investments account modeling convention

`buildBrokerageProjection` models the investments account from `currentAge` to `deathAge`. Result is `BrokerageRow[]`: `result[0]` is the initial state at `currentAge`; `result[k]` is the end-of-year state at `currentAge + k`. The balance in `result[k]` is what the networth chart plots at age `currentAge + k`.

Each year goes through four flows before growth:
1. **Contribution** (`i < workingYears`): `contributions[i]` — brokerage surplus with SRS already deducted.
2. **OA injection** (`endAge === cpfRetirementAge`): the OA balance from `buildCpfProjection`. One-time.
3. **Drawdown** (`stopWorkingAge ≤ startAge < srsWithdrawalAge`): `min(max(0, expenses − cpfLife), balance)`.
4. **Reinvestment** (`startAge >= srsWithdrawalAge`): `max(0, cpfLife + srsAnnualIncome − expenses)`.

```
balance = (balance + contribution + oaInjection − brokerageIncome + srsReinvestment) * (1 + growthRate)
```

Growth rate: `investmentGrowthRate` during working years, `investmentGrowthRateRetirement` after. Expense inflation: `annualExpensesToday * (1 + EXPENSES_INFLATION_RATE)^i`.

In the retirement page table, for a row at age `a`: **balance** = `brokerageRows[a - currentAge].balance` (start-of-year); **flows** = `brokerageRows[a - currentAge + 1]` (what happens during that year).

### Cash + accumulation modeling convention

`buildAccumulation` produces one `AccumulationRow` per working year. For year index `i`, `age = currentAge + i`:

- `salary = salarySeries[i] ?? startingSalary*(1+salaryGrowthRate)^i`; `takeHome = salary * (1 - CPF_EMPLOYEE_RATE)`
- `srsTopUp = min(srsTopUps[i] ?? 0, takeHome)`
- `tax = calculateTax(takeHome - srsTopUp)`
- `baseLiving = (monthlyExpenseSeries[i] ?? monthlyExpensesToday) * 12 * (1 + EXPENSES_INFLATION_RATE)^i`
- `livingExpenses = baseLiving + lumpsumThisYear`
- `cashTarget = monthly * emergencyMonths * inflationFactor`
- `available = takeHome - tax - livingExpenses + lumpsumInflowThisYear - srsTopUp`

**Allocation:**
- `available >= 0`: `cashTopup = clamp(cashTarget - cashBalance, 0, available)`; remainder → `invested`.
- `available < 0`: `cashTopup = -min(-available, cashBalance)` (cash absorbs deficit first); remainder → `invested` (can be ≤ 0, representing a brokerage withdrawal).

Cash earns no interest. Brokerage: `brokerageBalance = (brokerageBalance + invested) * (1 + investmentGrowthRate)`.

### Projection table — column visibility pattern

Both `/srs` and `/cpf` use: `hiddenCols: Set<ColId>` state + `showHidden` boolean toggle. Clicking a column header opens a per-column dropdown (`openMenu: ColId | null`, closed by a document `mousedown` listener) with "Hide column" / "Remove from hidden". Hidden columns render at 50% opacity when `showHidden` is true.

### Adding a new scheme page

Create `app/<name>/page.tsx`, read inputs via `useProfile`, and add the route to either `NAV_LINKS_BEFORE` or `NAV_LINKS_AFTER` in `app/components/navbar.tsx` (or wire it into `SplitNavButton` for the accumulation/cashflow/retirement cluster). Put all financial logic in `lib/` rather than in the component. Derive any duration from the age milestone fields rather than storing a raw year count.

## Next.js 16 note

Per `AGENTS.md`, this Next.js version has breaking changes vs. older training data. Consult `node_modules/next/dist/docs/` before changing routing, config, or build setup.
