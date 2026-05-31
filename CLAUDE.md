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
- `monthlyExpenseSeries: number[]` — per-year monthly spend during working years (today's money). Empty `[]` means "use `monthlyExpensesToday` flat". Inflation is applied at consumption time (`* (1+EXPENSES_INFLATION_RATE)^i`), not stored in the series. The config page's `expenseDisplaySeries` gracefully handles length mismatches — shorter series are padded with the last value, longer are truncated — so the series is never eagerly cleared by field changes. `handleSave` normalises to the correct length before writing to context. `buildAccumulation` uses `monthlyExpenseSeries[i] ?? monthlyExpensesToday` so a short series degrades gracefully.
- `investments: Investment[]` — breakdown of real networth by asset class. Each entry: `{ id, name, value, returnRate }`. The config page recomputes `startingCash` (sum) and `investmentGrowthRate` (value-weighted average return) whenever this changes.
- `cash` (10000) — zero-interest cash account balance. Tracked separately from `startingCash`; sized via the emergency-fund rule. Held flat post-`stopWorkingAge`.
- `emergencyMonths` (6) — months of expenses to keep as cash. The accumulation engine targets `monthly * emergencyMonths * inflation^i` each year.
- `lumpsumExpenses: LumpsumExpense[]`, `lumpsumInflows: LumpsumExpense[]` — one-time amounts at a specific age (`{ id, age, name, amount }`). Edited on `/config` *and* `/accumulation` (accumulation page uses a local-draft + Recalculate button to commit). The two BTO downpayment rows (`id: "exp-1"`, `id: "exp-2"`) are **auto-populated** from BTO data and locked (read-only) in the accumulation page UI when `btoFlatPrice > 0`.
- `srsAnnualCap` (15300) — annual SRS contribution cap.
- `srsAccepted: boolean[]` — per-working-year SRS accept/reject decisions. Length = `workingYears`; missing indices default to `true`. Persisted to localStorage and shared across all pages so the accumulation table, networth SRS chart, and retirement page all reflect the same choices. Empty `[]` means all years accepted.
- BTO fields — wired into CPF projections on `/cpf`, `/main`, `/bto`, `/accumulation`, and `/retirement`:
  - `btoApplicantType: "single" | "couple"` — currently cosmetic.
  - `btoFlatPrice` (500000), `btoApplicationAge` (28), `btoCollectionAge` (32) — `applicationAge` is DP1 age, `collectionAge` is DP2 age and mortgage start age.
  - `btoDownpaymentScheme: "normal" | "staggered" | "deferred"` — drives DP1/DP2 ratios (10/15, 5/20, 2.5/22.5).
  - `btoGrantFamily`, `btoGrantEhg`, `btoGrantPhg` — three housing grants summed and capped per-grant; each defaults to 0.
  - `btoLoanType: "hdb" | "bank"`, `btoBankInterestRate` (0.035 — only used when bank), `btoLoanTenureYears` (25, max 25 for HDB / 30 for bank).

`investmentGrowthRateRetirement` represents reduced risk tolerance after stopping work. `buildProjection` uses `investmentGrowthRate` for `i < workingYears` and switches to `investmentGrowthRateRetirement` for all subsequent years.

### Pages

- **`app/page.tsx`** — server-side redirect to `/main`.
- **`app/main/page.tsx`** — Overview page. **Four chart sections:** (1) Net Worth Breakdown — `LineChart` with five lines (Total, Investments, SRS Pot, CPF, Cash) from `currentAge` to `deathAge`, preceded by 4 KPI cards. (2) SRS Account — `AreaChart` of SRS pot with KPI cards (pot at withdrawal age, yearly withdrawal, tax/yr, yearly after tax). (3) Cash Reserve — `AreaChart` of cash balance with 2 KPI cards. (4) Investment Account — `AreaChart` of brokerage balance. All data is computed in a single `useMemo`: `buildAccumulation` (with `srsTopUps` derived from `srsAccepted`) → SRS pot accumulated manually from `accRows[i].srsTopUp` → `buildCpfProjection` → `buildBrokerageProjection` (with `contributions = accRows.map(r => r.invested)`). The SRS pot by age is computed by iterating `(pot + srsTopUp) * (1 + growthRate)` over working years, then growing at `investmentGrowthRateRetirement` until `srsWithdrawalAge`, then drawing down linearly. Y axis domain for the networth chart is explicitly set to peak total × 1.1 (rounded to nearest $500k) because recharts cannot auto-scale a multi-series domain. `runOutRow` and `canRetire` drive the green/red verdict banner.
- **`app/config/page.tsx`** — profile inputs page (labelled "Settings" in the nav). Uses a **local draft pattern**: all field changes update a local `draft` state; `setInputs` (which writes to context + `localStorage`) is only called when the user clicks **Recalculate**. An "Unsaved changes" badge appears when draft differs from saved inputs. Layout: left column (Personal Details + Retirement Settings), right column (CPF balances + government params), full-width investments table, then an **"Advanced" disclosure** (`showAdvanced` state, closed by default) hiding the BTO inputs panel and lumpsum tables. Key UI patterns: (1) **`LifelineSlider`** — a custom multi-handle bar (defined in the same file) replaces the three separate age `NumberField`s for `currentAge`, `stopWorkingAge`, `deathAge`; handles use `setPointerCapture` and a `latestValues` ref so rapid drags stay consistent; the working segment is `emerald-500`, the retirement segment `emerald-300`, and outside regions show a dotted line. (2) **Emergency months** — a pill-button selector for 3–9 months with an "Other" option that reveals a free-text number input when selected. (3) **Government-fixed params** (`srsWithdrawalAge`, `cpfRetirementAge`, `cpfWithdrawalAge`, `cpfLifeFrs`, `cpfLifeMonthlyPayout`) are displayed as read-only info panels with regulatory attribution rather than editable fields. Cascade rules: salary table edits at index `i` propagate as `parsed * (1+salaryGrowthRate)^(j-i)` to rows below. Monthly-expenses table edits propagate flat (today's money), since inflation is applied at consumption.
- **`app/bto/page.tsx`** — BTO mortgage planning page. Local-draft + Recalculate (mirrors `/accumulation`); `BtoInputsPanel` is shared with the config page so both sides edit the same `ProfileInputs` keys. Uses the **3-pass CPF pattern** (same as `/cpf` and `/main`): a single combined `useMemo` returns `{ breakdown, cpfRowsFull }` — `breakdown` uses the accurate post-DP1 OA for DP2, and `cpfRowsFull` has all BTO deductions applied. Below the existing breakdown timeline, a **mortgage repayment table** shows per-year split of annual mortgage between CPF OA and cash, with OA balance column; rows with cash payments are highlighted rose. At `btoCollectionAge`, the DP2 deduction is applied before the mortgage, so only `oaAfterDp2 = oa2 - dp2.fromOA` is available for the first mortgage payment.
- **`app/srs/page.tsx`** — SRS demo page. **Fully standalone — does not read from `useProfile`.** All inputs are local `useState` values. Always uses `buildProjection` with `livingExpensePct`-based expenses. Renders demo parameter controls, KPI cards, a pot-growth `LineChart`, a brokerage `AreaChart`, an annual projection table with hideable columns, and an SRS withdrawal breakdown. The disclaimer banner explains the disconnection from the rest of the app.
- **`app/cpf/page.tsx`** — CPF projection page. Passes `endAge: deathAge` to `buildCpfProjection`. Renders 3 KPI cards, a stacked `AreaChart` with OA/SA/MA/RA areas. OA is zeroed in the chart from `cpfRetirementAge` onwards. Two dotted `ReferenceLine`s at `cpfRetirementAge` (violet) and `cpfWithdrawalAge` (orange). Column visibility pattern (same as `/srs`): `hiddenCols: Set<ColId>` + `showHidden` toggle; default hidden = all four balance columns.
- **`app/accumulation/page.tsx`** — Working-years accumulation page (`currentAge` to `stopWorkingAge`). Calls `buildAccumulation` from `lib/cash-flow.ts`. Lumpsum tables use **local-draft + Recalculate** pattern. The lumpsum *expenses* table has two special locked rows (`exp-1`, `exp-2`) for BTO downpayment cash amounts — their age and amount are always overridden from BTO data (`effectiveDraftExpenses`) and they render as read-only with a "from BTO" badge. Additionally, **working-year mortgage cash payments** from `computeMortgageCashPayments` are injected into `buildAccumulation` as extra lumpsum expenses (labelled "BTO Mortgage") but are *not* shown in the lumpsum table UI — they appear as amber chips in the living-expenses column of the accumulation table. Annual table columns: age (with "⚠ Debt Alert!" when brokerage insolvent), take-home (with inflow chip), **SRS top-up** (per-row ✓/✗ toggle), tax, living expenses, cash on hand (actual / target), cash topup, investments topup. Toggling an SRS row calls `setInputs` immediately — no Recalculate needed.
- **`app/retirement/page.tsx`** — Retirement spending page. **SRS Withdrawal summary section** (5 `StatCard`s): SRS pot at `srsWithdrawalAge`, yearly gross withdrawal ×10, tax per year (50% of withdrawal is taxable), total from SRS after tax, yearly withdrawal after tax. Then the annual expenses table (`stopWorkingAge` to `deathAge`). **BTO mortgage cash payments** during retirement years are factored in three ways: (1) added to `buildWithdrawalRows` as per-age extra expenses (shown as rose "BTO Mortgage +$X" chips in the annual expenses column), (2) passed to `buildBrokerageProjection` as `extraExpensesByAge` so the drawdown and balance columns are accurate, and (3) included in the `buildAccumulation` call (via `workingMortgageLumpsums`) so the contributions array reflects actual investable amounts. Shortfall column: green surplus (+), red uncovered gap (−).

### Shared library

- **`lib/tax.ts`** — all money math. Pages are pure views — no financial logic in components. Key exports:
  - `calculateTax(income)` — IRAS resident tax brackets
  - `buildProjection(inputs)` — SRS/brokerage projection engine. Used only by the standalone `/srs` demo page. The main/retirement/accumulation pages do not use this — they derive the SRS pot directly from `buildAccumulation` rows.
  - `buildCpfProjection(inputs)` — CPF account projection engine. Optional `endAge` overrides `cpfWithdrawalAge` as the projection endpoint. Optional `oaDeductions: { age, amount }[]` applies BTO-related OA withdrawals; amounts for the same age are summed, then capped at the available OA balance.
  - `buildBrokerageProjection(inputs)` — investments account projection engine. Takes `contributions: number[]` (one entry per working year, SRS already deducted). Optional `extraExpensesByAge: Map<number, number>` adds per-age extra expenses on top of `annualExpensesToday` in both the drawdown and SRS-active phases — used for retirement-year BTO mortgage cash payments.
  - `recommendedSrsTopUp(income, maxTopUp)` — returns `{ topUp, taxSavings }`: the minimum top-up that drops `income` into the next-lower tax bracket, capped at `maxTopUp`. Returns `{ topUp: 0, taxSavings: 0 }` when already in the 0% bracket or the required amount exceeds `maxTopUp`.
  - `calculateSrsWithdrawal(srsPot, years?)` — returns `{ srsPot, yearlyWithdrawal, taxablePerYear, taxPerYear, totalTax, netFromSrs }`. Only 50% of each withdrawal (`SRS_TAXABLE_FRACTION`) is taxable.
  - `allocateCpfContribution(age, contribution)` — splits CPF contribution into `{ oa, sa, ma }`. Currently covers ages ≤55; a `TODO` marks where above-55 bands should be added.
  - Expense constants: `EXPENSES_INFLATION_RATE` (0.02), `MONTHLY_EXPENSES_TODAY` / `ANNUAL_EXPENSES_TODAY` — dollar constants superseded by `monthlyExpensesToday` from context, but `EXPENSES_INFLATION_RATE` is still imported by pages.
  - SRS constants: `SRS_ANNUAL_CAP` (15300), `CPF_EMPLOYEE_RATE` (0.2), `SRS_WITHDRAWAL_YEARS` (10), `SRS_TAXABLE_FRACTION` (0.5)
  - CPF constants: `CPF_OA_RATE` (0.025), `CPF_SA_RATE` (0.04), `CPF_MA_RATE` (0.04), `CPF_RA_RATE` (0.04), `CPF_TOTAL_CONTRIBUTION_RATE` (0.37), `CPF_FRS_INFLATION_RATE` (0.02)
- **`lib/cash-flow.ts`** — `buildAccumulation(inputs)` returns one `AccumulationRow` per working year (`age = currentAge + i`). The optional `srsTopUps: number[]` parameter drives per-year SRS deductions; when omitted, no SRS top-up is applied. Used by `/accumulation`, `/main`, and `/retirement`. See "Cash + accumulation modeling convention" below.
- **`lib/bto.ts`** — pure BTO compute. Imports `buildCpfProjection` from `lib/tax.ts`. Constants: `HDB_LOAN_RATE` (0.026), `GRANT_CAPS` (`{family: 80000, ehg: 120000, phg: 30000}`), `MAX_TENURE_HDB` (25), `MAX_TENURE_BANK` (30). Exports:
  - `computeBtoBreakdown(inputs, oaAtDp1Age, oaAtDp2Age)` — see "BTO modeling convention" below.
  - `computeMortgageCashPayments(inputs)` — runs the full 3-pass CPF projection internally and returns `{ age, amount }[]` for every mortgage year where the OA balance cannot cover the full annual payment. Only entries with `amount > 0` are returned. Used by `/accumulation` (filters to working years) and `/retirement` (filters to retirement years). At `btoCollectionAge`, DP2 is deducted from OA before the mortgage payment, so available OA = `oa2 - dp2.fromOA`.
  - `getDownpaymentRatios`, `rawGrantSum`, `totalGrantAmount`, `effectiveInterestRate`, `maxTenureFor`.
- **`lib/format.ts`** — `fmt` and `fmtMoney` helpers (en-SG locale).
- **`taxAmount.js`** — original CLI prototype, not imported. Keep `lib/tax.ts` as the source of truth.

### Shared UI

**`app/components/ui.tsx`** — `Slider`, `NumberField`, `StatCard`, `Stat`, `Th`, `Td`, `InfoTooltip`. Import from here rather than redefining per page. `NumberField` accepts an optional `disabled` prop that sets `opacity-40 pointer-events-none` on the wrapper and the native `disabled` attribute on the input — use this to render read-only government-fixed values rather than omitting the field entirely.

**`InfoTooltip`** — hover tooltip that renders via `createPortal` into `document.body`. Use this (not CSS `position: absolute`) whenever a tooltip is inside an `overflow-x-auto` container, because `overflow` clips absolutely-positioned descendants regardless of `z-index`. On `mouseEnter` it reads the icon's `getBoundingClientRect()` and positions the portal with `position: absolute` in page coordinates. A 100 ms hide delay lets the mouse travel from icon to tooltip without it disappearing, making links inside the tooltip clickable.

**`app/components/lumpsum-table.tsx`** — `LumpsumTable` editor for `LumpsumExpense[]` (used for both inflows and expenses). Props: `title`, `description`, `rows`, `onChange`, `totalAccent: "red" | "emerald"`, `idPrefix`, and optional `lockedIds?: Set<string>`. Rows whose `id` is in `lockedIds` render as read-only (static text, "from BTO" badge, no delete button). Purely controlled — owns no state.

**`app/components/lumpsum-tables.tsx`** — composite wrapper used by `/config` and `/accumulation`. Exports:
- `useBtoEffectiveExpenses(profileInputs, lumpsumExpenses)` — hook that runs a single-pass CPF projection to look up OA balances, calls `computeBtoBreakdown`, and returns `{ effectiveExpenses, btoLockedIds }`. `effectiveExpenses` overrides `exp-1`/`exp-2` amounts with BTO cash values; `btoLockedIds` is a `Set<string>` passed to `LumpsumTable`.
- `LumpsumTablesPanel` — renders both lumpsum tables side-by-side in a two-column grid, applying BTO overrides and locks automatically.

**`app/components/bto-inputs.tsx`** — `BtoInputsPanel`. Shared form for all BTO fields, used by both `/config` (inside the Advanced disclosure) and `/bto`. Props: `{ draft, setDraft }` — purely controlled. Internally clamps `btoLoanTenureYears` to `maxTenureFor(loanType)` whenever loan type changes.

**`app/components/navbar.tsx`** — sticky left sidebar nav. Links split into `NAV_LINKS_MAIN` (Networth, Accumulation, Retirement), `NAV_LINKS_SECONDARY` (CPF, BTO), and `NAV_LINKS_TOOLS` (SRS Demo). A **Settings** link (routes to `/config`) lives at the bottom of the sidebar next to the theme toggle — it is not in any of the three arrays. Also owns `useTheme`, which toggles a `dark` class on `<html>` and persists to `localStorage`.

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

### CPF modeling convention — BTO-aware 3-pass projection

`/cpf/page.tsx`, `/main/page.tsx`, and `/bto/page.tsx` all use a **3-pass pattern** when `btoFlatPrice > 0` to correctly account for OA deductions that reduce the balance available for DP2. `computeMortgageCashPayments` in `lib/bto.ts` also runs this pattern internally.

1. **Pass 1** — no deductions → look up `oaAtDp1Age`.
2. Compute DP1 OA deduction via `computeBtoBreakdown(inputs, oaAtDp1Age, 0)` (DP1 only depends on `oaAtDp1Age`; passing 0 for DP2 is intentional).
3. **Pass 2** — DP1 deduction only → look up `oaAtDp2Age` (the real post-DP1 balance).
4. Full `computeBtoBreakdown(inputs, oaAtDp1Age, oaAtDp2Age)` → build complete deductions list (DP1, DP2, all annual mortgage instalments).
5. **Pass 3** — all deductions → final rows displayed / used for `oaAtRetirement`.

When `btoFlatPrice <= 0` a single pass suffices.

The BTO page combines all three passes into a single `useMemo` that returns `{ breakdown, cpfRowsFull }`. `breakdown` is the accurate final breakdown; `cpfRowsFull` is the pass-3 result used for the mortgage repayment table.

### CPF projection internals

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

`expenses` in phases 3 and 4 = `annualExpensesToday * (1 + EXPENSES_INFLATION_RATE)^i + extraExpensesByAge.get(startAge)`. Growth rate: `investmentGrowthRate` during working years, `investmentGrowthRateRetirement` after.

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

Multiple `lumpsumExpenses` entries for the same age are all summed. The `lumpsumName` field shows the first matching name + "+N more" if there are multiple.

### BTO modeling convention

`computeBtoBreakdown(inputs, oaAtDp1Age, oaAtDp2Age)` produces every value the `/bto` page displays. Logic:

- Ratios from `getDownpaymentRatios(scheme)`. `dp1Amount = flatPrice * dp1Ratio`, `dp2Amount = flatPrice * dp2Ratio`.
- `totalGrant`: for `normal`/`staggered` it's `rawGrantSum(inputs)` (each grant capped at its limit). For `deferred` it's `0` — but `rawGrantSum` still flows forward as `leftoverGrantAfterDp1`.
- **DP1 allocation** (grant → OA → cash):
  - `dp1FromGrant = isDeferred ? 0 : min(totalGrant, dp1Amount)` — grant is capped at the proposed DP1 amount.
  - `dp1FromOA = min(dp1Amount − dp1FromGrant, oaAtDp1Age)`; rest is `dp1FromCash`.
  - `dp1.actualPaid` always equals `dp1.proposed`.
- **Leftover grant**: `isDeferred ? rawGrantSum : (totalGrant − dp1FromGrant)`.
- **DP2 allocation**: leftover grant is **fully applied** (not capped at DP2 proposed). If `leftoverGrant >= dp2Amount`, then `dp2FromGrantLeftover = leftoverGrant`, OA/cash both 0, and `actualPaid = leftoverGrant > proposed`. Otherwise, leftover grant covers what it can and the remainder draws OA → cash, with `actualPaid = dp2Amount`.
- `totalDownpayment = dp1Amount + dp2.actualPaid` (uses actual, so grant overflow inflates totals).
- `loanAmount = max(0, flatPrice − totalDownpayment)` — grant overflow shrinks the loan and feeds into LTV / monthly mortgage.
- `monthlyMortgage`: standard amortization `P*r(1+r)^n / ((1+r)^n − 1)` with `r = annualRate/12`, `n = tenureYears*12`. Edge case: `r === 0` ⇒ `P/n`. Rate is `HDB_LOAN_RATE` for HDB, `btoBankInterestRate` for bank.
- Mortgage runs from `btoCollectionAge` to `btoCollectionAge + tenureYears − 1`.
- OA balances are looked up from `buildCpfProjection` rows by exact age match; falls back to `cpfOA` when the requested age precedes `currentAge`.

### BTO cash-flow wiring (accumulation + retirement)

BTO affects the cash-flow pages in three layers, each computed on-the-fly (nothing extra is persisted to `ProfileInputs`):

1. **Downpayment cash** — `exp-1` / `exp-2` rows in `lumpsumExpenses` are overridden with `dp1.fromCash` / `dp2.fromCash` in `effectiveDraftExpenses` (accumulation page). They render as locked rows in the `LumpsumTable` UI. These feed directly into `buildAccumulation`.

2. **Mortgage cash (working years)** — `computeMortgageCashPayments(inputs)` filtered to `[currentAge, stopWorkingAge)` is appended to the lumpsum expenses list passed to `buildAccumulation` as entries labelled "BTO Mortgage". They show as amber chips in the living-expenses column but do not appear in the editable lumpsum table.

3. **Mortgage cash (retirement years)** — the same `computeMortgageCashPayments` result filtered to `[stopWorkingAge, deathAge]` is converted to a `Map<number, number>` (`retirementMortgageByAge`) and threaded into both `buildWithdrawalRows` (for display) and `buildBrokerageProjection` as `extraExpensesByAge` (for accurate drawdown).

### Projection table — column visibility pattern

Both `/srs` and `/cpf` use: `hiddenCols: Set<ColId>` state + `showHidden` boolean toggle. Clicking a column header opens a per-column dropdown (`openMenu: ColId | null`, closed by a document `mousedown` listener) with "Hide column" / "Remove from hidden". Hidden columns render at 50% opacity when `showHidden` is true.

### NumberField onChange gotcha

`NumberField` fires `onChange` on **every keystroke** using `parseFloat(e.target.value) || 0`. Clearing the field before typing a new value sends `0`. Never use an intermediate `onChange` value to destructively resize or clear an array (e.g. slicing `monthlyExpenseSeries` based on a transient `stopWorkingAge = 0`). Defer array normalisation to an explicit save action (`handleSave` / Recalculate), or guard with a minimum sensible value check.

### Adding a new scheme page

Create `app/<name>/page.tsx`, read inputs via `useProfile`, and add the route to `NAV_LINKS_MAIN` (primary pages) or `NAV_LINKS_SECONDARY` (CPF/BTO-style tools) in `app/components/navbar.tsx`. Put all financial logic in `lib/` rather than in the component. Derive any duration from the age milestone fields rather than storing a raw year count.

## Next.js 16 note

Per `AGENTS.md`, this Next.js version has breaking changes vs. older training data. Consult `node_modules/next/dist/docs/` before changing routing, config, or build setup.
