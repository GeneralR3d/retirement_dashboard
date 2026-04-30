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
- Financial inputs: `startingSalary`, `salaryGrowthRate`, `investmentGrowthRate` (0.07), `investmentGrowthRateRetirement` (0.025), `livingExpensePct`
- CPF starting balances: `cpfOA`, `cpfSA`, `cpfMA`, `cpfRA`
- CPF LIFE: `cpfLifeFrs` (200000), `cpfLifeMonthlyPayout` (1610)
- Salary override series: `salarySeries: number[]` — per-year gross salary array, length = `stopWorkingAge - currentAge`. Empty `[]` means "use formula". The config page always keeps it in sync; when `startingSalary`, `salaryGrowthRate`, `currentAge`, or `stopWorkingAge` change, the series is regenerated.
- `startingCash` (5000) — starting balance of the real networth account. **Derived** from `investments` in the config page; do not edit directly.
- `investmentGrowthRate` (0.07) — pre-retirement investment growth rate. **Derived** as the weighted average of `investments` in the config page; do not edit directly.
- `monthlyExpensesToday` (4000) — user-configured monthly retirement expenses in today's money. Pages derive annual expenses as `monthlyExpensesToday * 12`. This supersedes the old `MONTHLY_EXPENSES_TODAY` constant from `lib/tax.ts` for pages that read from context.
- `investments: Investment[]` — breakdown of real networth by asset class. Each entry: `{ id: string, name: string, value: number, returnRate: number }`. The config page recomputes `startingCash` (sum of values) and `investmentGrowthRate` (value-weighted average return) whenever this changes.

**`lib/srs-toggle-context.tsx`** — `SrsToggleProvider` + `useSrsToggle` hook. Holds `srsEnabled: boolean` (default `true`). Not persisted to localStorage — resets to enabled on page load. Mounted in `app/layout.tsx` inside `ProfileProvider`. The toggle switch is rendered on the `/main` and `/withdrawals` pages; any page can read or set it via `useSrsToggle`.

`investmentGrowthRateRetirement` represents reduced risk tolerance after stopping work. `buildProjection` uses `investmentGrowthRate` for `i < workingYears` and switches to `investmentGrowthRateRetirement` for all subsequent years.

### Pages

- **`app/page.tsx`** — server-side redirect to `/main`.
- **`app/main/page.tsx`** — Overview page with two sections. Renders the SRS toggle switch (via `useSrsToggle`), which gates SRS income in both brokerage and networth projections. **Top section:** Net Worth Breakdown — a `LineChart` with four lines (Total Net Worth, Brokerage, SRS Pot, CPF) from `currentAge` to `deathAge`, preceded by 4 KPI cards (net worth today, peak net worth, net worth at death, OA transfer). CPF line uses total balance minus OA after `cpfRetirementAge`; SRS line uses `buildProjection` rows during accumulation then linear drawdown over `SRS_WITHDRAWAL_YEARS` from `srsWithdrawalAge`. Y axis domain is explicitly set to peak total × 1.1 (rounded to nearest $500k) because recharts cannot auto-scale a multi-series domain. **Bottom section:** Real Networth Account — a single `LineChart` of the brokerage balance with 4 KPI cards (starting cash, OA transfer, peak brokerage, brokerage at death). Both charts share four dotted reference lines: amber at `stopWorkingAge` (omitted when equal to `cpfRetirementAge`), violet at `cpfRetirementAge`, cyan at `srsWithdrawalAge`, orange at `cpfWithdrawalAge`. All data is computed in a single `useMemo` that calls `buildProjection`, `buildCpfProjection`, and `buildBrokerageProjection`. Expenses use `monthlyExpensesToday * 12` from context.
- **`app/config/page.tsx`** — profile inputs page. Uses a **local draft pattern**: all field/slider changes update a local `draft` state; `setInputs` (which writes to context + `localStorage`) is only called when the user clicks **Recalculate**. An "Unsaved changes" badge appears when draft differs from saved inputs. Layout:
  - *Left column (two stacked cards):*
    - **Personal Details** — age fields, starting salary (with CPF info tooltip), salary growth rate (accordion that expands to an editable salary table), post-retirement investment growth rate slider, living expenses slider.
    - **Retirement Settings** — monthly expenses in retirement, annual equivalent info box, SRS withdrawal age.
  - *Right column:* CPF starting balances (OA/SA/MA/RA), CPF LIFE fields (FRS, monthly payout), CPF age milestones (retirement age, withdrawal age).
  - *Full-width below grid:* **Real Networth Account** — investments table. Each row: editable name, value input, rate-of-return slider (0–20%). Footer shows total value and value-weighted average return. The `+ Add row` button appends a custom row. Editing any investment calls `updateInvestments`, which recomputes `startingCash` and `investmentGrowthRate` in the draft before saving.
  - The salary table (inside the accordion) edits `salarySeries` directly; editing cell `i` cascades `newGross * (1 + salaryGrowthRate)^(j-i)` to all rows below.
- **`app/srs/page.tsx`** — SRS projection page. A projection-only view comparing SRS vs no-SRS — key assumption is no withdrawals from the brokerage pot before `srsWithdrawalAge` (flagged by an amber disclaimer banner). Derives `years = srsWithdrawalAge - currentAge` and `workingYears = stopWorkingAge - currentAge`. Renders KPI cards, a pot-growth `LineChart` (With/Without SRS), a brokerage accumulation `AreaChart` (accumulation only, through `srsWithdrawalAge` — no depletion phase), an annual projection table with hideable columns, and an SRS withdrawal breakdown section. The brokerage chart shows contributions during working years and zero-contribution growth at `investmentGrowthRateRetirement` after `stopWorkingAge`. The SRS withdrawal breakdown bottom row shows a three-card equation: `brokeragePot (at srsWithdrawalAge) + netSRS = finalTakeHome`.
- **`app/cpf/page.tsx`** — CPF projection page. Passes `endAge: deathAge` to `buildCpfProjection` so projections run from `currentAge` to `deathAge`. Renders 3 KPI cards (FRS target, CPF LIFE premium lump sum, annual CPF LIFE payout), a stacked `AreaChart` with OA/SA/MA/RA areas. OA is zeroed in the chart from `cpfRetirementAge` onwards (because OA is transferred to the real networth at that age). Two dotted `ReferenceLine`s: violet at `cpfRetirementAge` (SA→RA + OA→Brok) and orange at `cpfWithdrawalAge` (CPF LIFE purchase). The SA→RA conversion row in the table has both "SA→RA" (violet) and "OA→Brok" (sky) badges; CPF LIFE row has "CPF LIFE" (orange). Total Balance column excludes OA for all rows from `cpfRetirementAge` onwards.
- **`app/withdrawals/page.tsx`** — Retirement spending page. Also renders the SRS toggle switch. `buildWithdrawalRows` (local to the page) produces rows from `stopWorkingAge` to `deathAge` with `annualExpenses`, `cpfLifeIncome`, `srsIncome`, and `shortfall`. Expenses use `monthlyExpensesToday * 12` from context (not the `MONTHLY_EXPENSES_TODAY` constant). Also calls `buildBrokerageProjection` to populate brokerage income and brokerage balance columns. When `srsEnabled` is false, `srsIncome` is zeroed and the brokerage projection accounts for the increased shortfall. Brokerage income column shows: sky-blue for withdrawals (drawdown phase), violet with "+" prefix for surplus reinvestments (post-SRS phase), "—" otherwise. Shortfall column shows the residual after brokerage withdrawal (green surplus, red uncovered gap).

### Shared library

- **`lib/tax.ts`** — all money math. Pages are pure views — no financial logic in components. Key exports:
  - `calculateTax(income)` — IRAS resident tax brackets
  - `buildProjection(inputs)` — SRS/brokerage projection engine (see SRS modeling convention below)
  - `buildCpfProjection(inputs)` — CPF account projection engine (see CPF modeling convention below). Optional `endAge` overrides `cpfWithdrawalAge` as the projection endpoint.
  - `buildBrokerageProjection(inputs)` — real networth account projection engine. Returns `BrokerageRow[]` where each row has `age`, `balance`, `brokerageIncome`, `srsReinvestment`.
  - `calculateSrsWithdrawal(srsPot, years?)` — post-accumulation SRS drawdown
  - `allocateCpfContribution(age, contribution)` — splits a CPF contribution into `{ oa, sa, ma }` using the CPF Board allocation-ratio table. Currently covers ages ≤55; a `TODO` marks where above-55 bands should be added.
  - Expense constants: `MONTHLY_EXPENSES_TODAY` (4000), `ANNUAL_EXPENSES_TODAY` (48000), `EXPENSES_INFLATION_RATE` (0.02) — `EXPENSES_INFLATION_RATE` is still imported by pages; the dollar constants are superseded by `monthlyExpensesToday` from context.
  - SRS constants: `SRS_ANNUAL_CAP` (15300), `CPF_EMPLOYEE_RATE` (0.2), `SRS_WITHDRAWAL_YEARS` (10), `SRS_TAXABLE_FRACTION` (0.5)
  - CPF constants: `CPF_OA_RATE` (0.025), `CPF_SA_RATE` (0.04), `CPF_MA_RATE` (0.04), `CPF_RA_RATE` (0.04), `CPF_TOTAL_CONTRIBUTION_RATE` (0.37), `CPF_FRS_INFLATION_RATE` (0.02)
- **`lib/format.ts`** — `fmt` and `fmtMoney` helpers (en-SG locale).
- **`taxAmount.js`** — original CLI prototype, not imported. Keep `lib/tax.ts` as the source of truth.

### Shared UI

**`app/components/ui.tsx`** — `Slider`, `NumberField`, `StatCard`, `Stat`, `Th`, `Td`. Import from here rather than redefining per page.

**`app/components/navbar.tsx`** — sticky nav with links to `/main`, `/srs`, `/cpf`, `/withdrawals`, `/config`. Also owns `useTheme`, which toggles a `dark` class on `<html>` and persists to `localStorage`. Active link is derived from `usePathname`.

### Theme

`app/layout.tsx` sets `className="dark"` on `<html>` for SSR first-paint; `suppressHydrationWarning` is required because `useTheme` may flip it on mount. `app/globals.css` uses Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` follows the class toggle, not `prefers-color-scheme`. Chart axis/grid/tooltip colours are CSS custom properties (`--axis-color`, `--grid-color`, `--tooltip-bg`) defined per theme in `globals.css` and referenced by string in the recharts config.

### SRS modeling convention

All cash flows are derived from `takeHome = salary * (1 - CPF_EMPLOYEE_RATE)`. For a given year index `i`:

- If `i < workingYears`: `salary = salarySeries[i]` when the series is available, otherwise `startingSalary * (1 + salaryGrowthRate)^i`; beyond working years `salary = 0`
- `cpfContribution = salary * 0.20`
- `takeHome        = salary - cpfContribution`
- `livingExpenses  = takeHome * livingExpensePct`
- `srsContribution = min(SRS_ANNUAL_CAP, takeHome)`
- `taxNoSrs        = calculateTax(takeHome)`
- `taxWithSrs      = calculateTax(takeHome - srsContribution)`
- Without SRS: `investedNoSrs = takeHome - taxNoSrs - livingExpenses`
- With SRS: `brokerageWithSrs = takeHome - srsContribution - taxWithSrs - livingExpenses`; `investedWithSrs = srsContribution + brokerageWithSrs`
- Growth rate: `growthRate = i < workingYears ? investmentGrowthRate : investmentGrowthRateRetirement`
- Each pot grows as `pot = (pot + invested) * (1 + growthRate)` per year (contribution at start of year).
- Post-retirement years (`i >= workingYears`): salary = 0, contributions = 0, pots grow at `investmentGrowthRateRetirement` only — no withdrawals are modeled within `buildProjection`.

`ProjectionInputs.workingYears` defaults to `years` if omitted. `ProjectionInputs.srsCap` defaults to `SRS_ANNUAL_CAP`. `ProjectionInputs.investmentGrowthRateRetirement` defaults to `investmentGrowthRate` if omitted (backward-compatible). `ProjectionInputs.salarySeries` is optional; if provided and `length === workingYears`, it overrides the formula. `calculateSrsWithdrawal` accepts an optional `years` override (defaults to `SRS_WITHDRAWAL_YEARS` = 10).

### SRS page KPI reference ages

All SRS page snapshot values are taken at `srsWithdrawalAge` (the final row of `buildProjection`):
- `final = rows[rows.length - 1]` → age `srsWithdrawalAge`
- "SRS pot at age N" = `final.srsPot`
- "Brokerage pot (with SRS scenario)" = `final.brokeragePotWithSrs`
- "Final take-home pot" = `final.brokeragePotWithSrs + withdrawal.netFromSrs`
- "SRS advantage (post-withdrawal)" = `takeHomeWithSrs - final.potNoSrs`

The brokerage pot grows at `investmentGrowthRateRetirement` during the gap between `stopWorkingAge` and `srsWithdrawalAge` with no withdrawals, which is a simplifying assumption flagged by the disclaimer banner.

### CPF modeling convention

`buildCpfProjection` uses `CPF_TOTAL_CONTRIBUTION_RATE` (37% of gross salary, covering both employee and employer shares). For year index `i` (age = `currentAge + i`):

- If `i < workingYears`: salary from formula; otherwise `salary = 0`
- `totalContribution = salary * 0.37`
- `allocateCpfContribution(currentAge + i, totalContribution)` produces `{ oa, sa, ma }` (ages ≤55 only; above-55 TODO)
- After the SA→RA conversion, any would-be SA contributions are redirected to OA
- Each account grows as `balance = (balance + contribution) * (1 + rate)` per year
- OA: 2.5%, SA: 4%, MA: 4%, RA: 4%

**SA→RA conversion** at `cpfRetirementAge` (default 55), applied at end of the year whose `age === cpfRetirementAge`:
- `raTarget = cpfLifeFrs * (1 + CPF_FRS_INFLATION_RATE)^(cpfRetirementAge - currentAge)`
- If `saBalance >= raTarget`: excess `(saBalance - raTarget)` goes to OA; RA receives `raTarget`; SA = 0
- If `saBalance < raTarget`: deficit drawn from OA; RA receives `raTarget`; SA = 0
- `CpfYearRow.raConversionHappened` is `true` on that row; SA contributions are redirected to OA for all subsequent years
- After the conversion, the full OA balance is transferred to the real networth account (see below)

**CPF LIFE annuity purchase** at `cpfWithdrawalAge` (default 65), applied at end of the year whose `age === cpfWithdrawalAge`:
- The full RA balance is recorded as `CpfYearRow.cpfLifePremium` (the lump-sum premium paid)
- RA balance is set to 0; `CpfYearRow.cpfLifeHappened` is `true` on that row
- The annual payout is `cpfLifeMonthlyPayout * 12 * (1 + CPF_FRS_INFLATION_RATE)^(cpfWithdrawalAge - currentAge)` — computed in the page, not in `buildCpfProjection`; the payout is fixed from that age onward (no further inflation)

### Real networth modeling convention

`buildBrokerageProjection` models a single real networth account from `currentAge` to `deathAge`. The result is `BrokerageRow[]` with an initial row at `age = currentAge` (balance = `startingCash`, no flows) followed by one end-of-year row per year. **Row indexing:** `result[0]` is the initial state; `result[k]` covers the year with `startAge = currentAge + k - 1`, `endAge = currentAge + k`. To look up data for a withdrawal-table row at age `a`, use `result[a - currentAge + 1]` or build a map `startAge → result[k]` (done via `brokerageRows[k].age - 1` in pages).

Each year goes through four additive flows before growth:

1. **Contribution** (`i < workingYears`): `srsRows[i].brokerageWithSrs` — the annual brokerage surplus from the SRS projection (take-home minus SRS, tax, and living expenses). Zero after `stopWorkingAge`.
2. **OA injection** (`endAge === cpfRetirementAge`): the OA balance from `buildCpfProjection` at the `raConversionHappened` row. One-time event.
3. **Drawdown** (`stopWorkingAge ≤ startAge < srsWithdrawalAge`): withdraws `min(shortfall, balance)` where `shortfall = max(0, expenses − cpfLife)`. CPF LIFE income offsets the shortfall if `startAge >= cpfWithdrawalAge`.
4. **Reinvestment** (`startAge >= srsWithdrawalAge`): `max(0, cpfLife + srsAnnualIncome − expenses)` — any surplus from SRS and CPF LIFE over inflation-adjusted expenses is reinvested.

Growth rate is `investmentGrowthRate` during working years, `investmentGrowthRateRetirement` after. The balance update each year:
```
balance = (balance + contribution + oaInjection − brokerageIncome + srsReinvestment) * (1 + growthRate)
```

Expense inflation: `annualExpensesToday * (1 + EXPENSES_INFLATION_RATE)^i` where `i = startAge - currentAge` and `annualExpensesToday = monthlyExpensesToday * 12` from `ProfileInputs`.

`srsAnnualIncome` = `calculateSrsWithdrawal(srsPot).netFromSrs / SRS_WITHDRAWAL_YEARS` — treated as perpetual from `srsWithdrawalAge` (same simplification used in the withdrawals page).

### Projection table — column visibility pattern

Both `/srs` and `/cpf` use the same pattern: `hiddenCols: Set<ColId>` state plus a `showHidden` boolean toggle. Clicking any column header opens a per-column dropdown (`openMenu: ColId | null`, closed by a document `mousedown` listener) with "Hide column" / "Remove from hidden". A button beside the section title toggles `showHidden`. Hidden columns render at 50% opacity when `showHidden` is true. Default hidden sets: SRS hides the two tax columns; CPF hides all four balance columns (OA/SA/MA/RA).

### Adding a new scheme page

Create `app/<name>/page.tsx`, read inputs via `useProfile`, add the route to `NAV_LINKS` in `app/components/navbar.tsx`, and put all financial logic in `lib/` rather than in the component. Derive any duration from the age milestone fields rather than storing a raw year count.

## Next.js 16 note

Per `AGENTS.md`, this Next.js version has breaking changes vs. older training data. Consult `node_modules/next/dist/docs/` before changing routing, config, or build setup.
