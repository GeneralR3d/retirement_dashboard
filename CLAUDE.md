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

### App shell — double-pane planner

The app is a **double-pane planner**. `app/layout.tsx` renders a slim **top nav bar** (`app/components/navbar.tsx`) with three main links — Planner (`/main`), SRS Demo (`/srs`), Support Us (`/about`) — over a fixed-height body (`h-screen overflow-hidden`); each route group layout owns its own scrolling.

- **`app/(planner)/`** route group — `main`, `accumulation`, `retirement`, `cpf`, `bto`, `inputs`. Its `layout.tsx` delegates to the client `PlannerShell` (`app/components/planner-shell.tsx`). **Desktop (md+):** persistent **left 1/3 inputs pane** (`app/components/inputs-panel.tsx`, the former Calculator page) and a right 2/3 pane with a thin **sub-nav tab pill** (`app/components/planner-tabs.tsx`, small text + lucide icon per tab) above the page content. Both panes scroll independently; only the right pane swaps on navigation, so the inputs draft state survives sub-page switches. The footer renders at the bottom of the right pane's scroll area. **Mobile (<md):** single pane — the sub-nav becomes a fixed thumb-reachable **bottom tab bar** with an extra **Inputs** tab (`/inputs`) that shows the inputs pane full-width; `app/(planner)/inputs/page.tsx` itself only renders a desktop fallback note (the shell hides the right section on mobile at that path).
- **`app/(site)/`** route group — `srs`, `about`, `terms`, `privacy`. Full-width single scrolling column with the footer at the bottom; no inputs pane.
- `/` and `/config` are server-side redirects to `/main` (the `/config` route is kept for old bookmarks). Route groups do not affect URLs.

Historical references to "the config page" in this file mean `app/components/inputs-panel.tsx` — all the Calculator logic (local draft, Recalculate, cascade rules) lives there now.

### Shared state

**`lib/profile-context.tsx`** — `ProfileProvider` + `useProfile` hook. Holds all user inputs and persists them to `localStorage`. The provider is mounted in `app/layout.tsx` so every page shares the same source of truth. Default values live in the `DEFAULTS` constant. Also exports `CPF_RATES` (OA 2.5%, SA/MA/RA 4%); the same values are exported as individual constants from `lib/tax.ts` (`CPF_OA_RATE` etc.) for use in financial logic.

`ProfileInputs` fields:
- Age milestones: `currentAge` (25), `stopWorkingAge` (55), `cpfWithdrawalAge` (65), `cpfRetirementAge` (55), `srsWithdrawalAge` (63), `deathAge` (83)
- Financial inputs: `startingSalary`, `salaryGrowthRate`, `investmentGrowthRate` (0.07), `investmentGrowthRateRetirement` (0.025), `livingExpensePct` (used only by the standalone `/srs` demo page via `buildProjection`; all other pages use `monthlyExpenseSeries` instead).
- CPF starting balances: `cpfOA`, `cpfSA`, `cpfMA`, `cpfRA`
- CPF LIFE: `cpfLifeFrs` (220400 — 2026 figure), `cpfLifeMonthlyPayout` (1610)
- Salary override series: `salarySeries: number[]` — per-year gross salary array, length = `stopWorkingAge - currentAge`. Empty `[]` means "use formula". The config page always keeps it in sync; when `startingSalary`, `salaryGrowthRate`, `currentAge`, or `stopWorkingAge` change, the series is regenerated.
- `startingCash` (5000) — brokerage seed balance. **Derived** from `investments` in the config page; do not edit directly.
- `investmentGrowthRate` (0.07) — pre-retirement investment growth rate. **Derived** as the weighted average of `investments` in the config page; do not edit directly.
- `monthlyExpensesToday` (3000) — base monthly expenses in today's money during working years. Used as the seed value for `monthlyExpenseSeries`.
- `monthlyExpensesRetirement` (3000) — base monthly expenses in today's money during retirement. Used by the retirement page directly (`* 12 * inflation^k`). Separate from `monthlyExpensesToday` so users can model a different spending level post-retirement.
- `monthlyExpenseSeries: number[]` — per-year monthly spend during working years (today's money). Empty `[]` means "use `monthlyExpensesToday` flat". Inflation is applied at consumption time (`* (1+EXPENSES_INFLATION_RATE)^i`), not stored in the series. The config page's `expenseDisplaySeries` gracefully handles length mismatches — shorter series are padded with the last value, longer are truncated — so the series is never eagerly cleared by field changes. `handleSave` normalises to the correct length before writing to context. `buildAccumulation` uses `monthlyExpenseSeries[i] ?? monthlyExpensesToday` so a short series degrades gracefully.
- `investments: Investment[]` — breakdown of real networth by asset class. Each entry: `{ id, name, value, returnRate }`. The config page recomputes `startingCash` (sum) and `investmentGrowthRate` (value-weighted average return) whenever this changes.
- `cash` (10000) — zero-interest cash account balance. Tracked separately from `startingCash`; sized via the emergency-fund rule. Held flat post-`stopWorkingAge`.
- `emergencyMonths` (6) — months of expenses to keep as cash. The accumulation engine targets `monthly * emergencyMonths * inflation^i` each year.
- `lumpsumExpenses: LumpsumExpense[]`, `lumpsumInflows: LumpsumExpense[]` — one-time amounts at a specific age (`{ id, age, name, amount }`). Edited **only** in the inputs panel's "One-time Inflows & Expenses" card (`app/components/inputs-panel.tsx`, local-draft + Recalculate). The two BTO downpayment rows (`id: "exp-1"`, `id: "exp-2"`) are **auto-populated** from BTO data and locked (read-only) in that UI when `btoFlatPrice > 0`. The `/accumulation` page still applies the same `exp-1`/`exp-2` cash overrides to its projection via `useBtoEffectiveExpenses`, but no longer renders any lumpsum editor.
- `srsAnnualCap` (15300) — annual SRS contribution cap.
- `srsAccepted: boolean[]` — per-working-year SRS accept/reject decisions. Length = `workingYears`; missing indices default to `true`. Persisted to localStorage and shared across all pages so the accumulation table, networth SRS chart, and retirement page all reflect the same choices. Empty `[]` means all years accepted.
- `srsManualTopUps: number[]` — per-working-year manual SRS top-up amounts, applied **only** for years where `recommendedSrsTopUp` returns 0 (the accumulation table shows an inline editor in place of "No SRS topups recommended"). Capped at `srsAnnualCap`; `0`/missing = none. Persisted to localStorage and honoured by all three `srsTopUps` derivation sites (`/accumulation`, `lib/projection.ts`, `/retirement`). Committing a manual amount calls `setInputs` immediately — no Recalculate needed.
- `taxReliefsPerYear: Record<string, number>[]` — per-working-year tax relief and donation deduction selections. Each element maps a relief ID (e.g. `"earned_income"`, `"cpf_employee"`) to the claimed amount. The special key `"donation_amount"` stores the raw donation made to approved IPCs; the effective deduction is `donation_amount × 2.5` and is applied **outside** the $80,000 relief cap. Missing indices default to `{}` (no reliefs). Saved to localStorage and applied immediately (no Recalculate needed — handled by the `TaxReliefPane` save action).
- BTO fields — wired into CPF projections on `/cpf`, `/main`, `/bto`, `/accumulation`, and `/retirement`:
  - `btoApplicantType: "single" | "couple"` — currently cosmetic. The "single" option is disabled in the UI (coming soon); value is always "couple".
  - `btoFlatPrice` (500000), `btoApplicationAge` (28), `btoCollectionAge` (32) — `applicationAge` is DP1 age, `collectionAge` is DP2 age and mortgage start age.
  - `btoDownpaymentScheme: "normal" | "staggered" | "deferred"` — drives DP1/DP2 ratios. HDB: normal (10%/15%), staggered (5%/20%), deferred (2.5%/22.5%). Bank (assumes 75% LTV): normal (20%/5%), staggered (10%/15%), deferred (2.5%/22.5%).
  - `btoGrantFamily`, `btoGrantEhg`, `btoGrantPhg` — three housing grants summed and capped per-grant; each defaults to 0.
  - `btoLoanType: "hdb" | "bank"`, `btoBankInterestRate` (0.035 — only used when bank), `btoLoanTenureYears` (25, max 25 for HDB / 30 for bank).

`investmentGrowthRateRetirement` represents reduced risk tolerance after stopping work. `buildProjection` uses `investmentGrowthRate` for `i < workingYears` and switches to `investmentGrowthRateRetirement` for all subsequent years.

### Pages

- **`app/page.tsx`** — public landing page at `/` (Server Component). A centered hero with the Retirement.sg tagline and a single green pill "Get started" button linking to `/main`. `app/config/page.tsx` is a server-side redirect to `/main`.
- **`app/components/inputs-panel.tsx`** — the **inputs panel** (formerly the Calculator page), mounted in the `(planner)` layout's left pane. Uses a **local draft pattern**: all field changes update a local `draft` state; `setInputs` (which writes to context + `localStorage`) is only called when the user clicks **Recalculate**. Because the panel stays mounted across sub-page navigation and mounts before `localStorage` hydration, a `useEffect` adopts upstream `inputs` changes into the draft **only when the draft has no unsaved edits** (deep-equal check against the previous `inputs`) — this handles both hydration and immediate saves from other pages (SRS toggles, tax reliefs). Cards: Personal Details, Retirement Settings, CPF Starting Balances, Investment Account, BTO / Housing, One-time Inflows & Expenses. **Every card has its own `RecalcFooter`** (Recalculate button + "Unsaved changes" badge); each button commits the whole draft. Key UI patterns: (1) **`LifelineSlider`** — a custom multi-handle bar (defined in the same file) for `currentAge`, `stopWorkingAge`, `deathAge`; handles use `setPointerCapture` and a `latestValues` ref so rapid drags stay consistent; the working segment is `emerald-500`, the retirement segment `emerald-300`, and outside regions show a dotted line. (2) **Emergency months** — a pill-button selector for 3–9 months with an "Other" option that reveals a free-text number input when selected. (3) **Government-fixed params** (`srsWithdrawalAge`, `cpfRetirementAge`, `cpfWithdrawalAge`, `cpfLifeFrs`, `cpfLifeMonthlyPayout`) are displayed as read-only info panels with regulatory attribution rather than editable fields. Cascade rules: salary table edits at index `i` propagate as `parsed * (1+salaryGrowthRate)^(j-i)` to rows below. Monthly-expenses table edits propagate flat (today's money), since inflation is applied at consumption.
- **`app/main/page.tsx`** — Overview page. **Four chart sections:** (1) Net Worth Breakdown — `LineChart` with five lines (Total, Investments, SRS Pot, CPF, Cash) from `currentAge` to `deathAge`, preceded by 4 KPI cards. (2) SRS Account — `AreaChart` of SRS pot with KPI cards (pot at withdrawal age, yearly withdrawal, tax/yr, yearly after tax). (3) Cash Reserve — `AreaChart` of cash balance with 2 KPI cards. (4) Investment Account — `AreaChart` of brokerage balance. All data comes from `buildFullProjection(inputs)` in `lib/projection.ts` (single `useMemo` keyed on `inputs`), which runs `buildAccumulation` (with `srsTopUps` derived from `srsAccepted`) → SRS pot accumulated from `accRows[i].srsTopUp` → 3-pass `buildCpfProjection` → `buildBrokerageProjection`, and also returns the derived verdict (`canRetire`, `runOutRow`), `peakNwRow`, and the `summary` facts for `SmartSummary`. Y axis domain for the networth chart is explicitly set to peak total × 1.1 (rounded to nearest $500k) because recharts cannot auto-scale a multi-series domain. `runOutRow` and `canRetire` drive the green/red verdict banner.
- **`app/bto/page.tsx`** — BTO mortgage planning page. **Read-only view** — it reads directly from committed `inputs` with no local draft, no Recalculate button, and no inputs form; all BTO fields are edited in the inputs panel. Uses the **3-pass CPF pattern** (same as `/cpf` and `/main`): a single combined `useMemo` returns `{ breakdown, cpfRowsFull }` — `breakdown` uses the accurate post-DP1 OA for DP2, and `cpfRowsFull` has all BTO deductions applied. Below the existing breakdown timeline, a **mortgage repayment table** shows per-year split of annual mortgage between CPF OA and cash, with OA balance column; rows with cash payments are highlighted rose. At `btoCollectionAge`, the DP2 deduction is applied before the mortgage, so only `oaAfterDp2 = oa2 - dp2.fromOA` is available for the first mortgage payment.
- **`app/srs/page.tsx`** — SRS demo page. **Fully standalone — does not read from `useProfile`.** All inputs are local `useState` values. Always uses `buildProjection` with `livingExpensePct`-based expenses. Renders demo parameter controls, KPI cards, a pot-growth `LineChart`, a brokerage `AreaChart`, an annual projection table with hideable columns, and an SRS withdrawal breakdown. The disclaimer banner explains the disconnection from the rest of the app.
- **`app/cpf/page.tsx`** — CPF projection page. Passes `endAge: deathAge` to `buildCpfProjection`. Renders 3 KPI cards, a stacked `AreaChart` with OA/SA/MA/RA areas. OA is zeroed in the chart from `cpfRetirementAge` onwards. Two dotted `ReferenceLine`s at `cpfRetirementAge` (violet) and `cpfWithdrawalAge` (orange). Column visibility pattern (same as `/srs`): `hiddenCols: Set<ColId>` + `showHidden` toggle; default hidden = all four balance columns.
- **`app/accumulation/page.tsx`** — Working-years accumulation page (`currentAge` to `stopWorkingAge`). Calls `buildAccumulation` from `lib/cash-flow.ts`. Reads lumpsums directly from committed `inputs` — no lumpsum editor and no Recalculate button (those moved to the inputs panel). The `exp-1`/`exp-2` BTO downpayment cash amounts are still overridden from BTO data via `useBtoEffectiveExpenses` (`effectiveExpenses`) before feeding `buildAccumulation`. Additionally, **working-year mortgage cash payments** from `computeMortgageCashPayments` are injected into `buildAccumulation` as extra lumpsum expenses (labelled "BTO Mortgage") but are *not* shown in the lumpsum table UI — they appear as amber chips in the living-expenses column of the accumulation table. Annual table columns: age (with "⚠ Debt Alert!" when brokerage insolvent), take-home (with inflow chip), **SRS top-up** (per-row ✓/✗ toggle), **tax** (clickable — opens `TaxReliefPane`; shows a "−$X relief" line below the amount when reliefs are active), living expenses, cash on hand (actual / target), cash topup, investments topup. Toggling an SRS row and saving tax reliefs both call `setInputs` immediately — no Recalculate needed.
- **`app/retirement/page.tsx`** — Retirement spending page. **SRS Withdrawal summary section** (5 `StatCard`s): SRS pot at `srsWithdrawalAge`, yearly gross withdrawal ×10, tax per year (50% of withdrawal is taxable), total from SRS after tax, yearly withdrawal after tax. Then the annual expenses table (`stopWorkingAge` to `deathAge`). **BTO mortgage cash payments** during retirement years are factored in three ways: (1) added to `buildWithdrawalRows` as per-age extra expenses (shown as rose "BTO Mortgage +$X" chips in the annual expenses column), (2) passed to `buildBrokerageProjection` as `extraExpensesByAge` so the drawdown and balance columns are accurate, and (3) included in the `buildAccumulation` call (via `workingMortgageLumpsums`) so the contributions array reflects actual investable amounts. Shortfall column: green surplus (+), red uncovered gap (−).
- **`app/terms/page.tsx`** — Static Terms of Use page. A **Server Component** that reads `content/terms-of-use.md` with `fs.readFileSync` at build time and passes the raw string to `app/terms/markdown-page.tsx` (a `"use client"` component that renders it via `react-markdown`). The split is necessary because `fs` is Node-only and `react-markdown` is a client component. The `content/` directory at the repo root is the convention for markdown-source static pages; add new ones there and follow the same server/client split pattern.
- **`app/about/page.tsx`** — About / support page. Uses `PayNowQr` (`app/components/paynow-qr.tsx`) for a click-to-enlarge PayNow donation QR modal. `/privacy` remains a placeholder route (not yet built).

### Shared library

- **`lib/tax.ts`** — all money math. Pages are pure views — no financial logic in components. Key exports:
  - `calculateTax(income)` — IRAS resident tax brackets
  - `getTaxBreakdown(income)` — returns `{ bracketFrom, bracketTo, rate, baseTax, marginalTax, totalTax }` for displaying bracket detail in `TaxReliefPane`.
  - `TAX_BRACKETS` — exported raw bracket array (limit / base / rate), used by `getTaxBreakdown`.
  - `TAX_RELIEF_CAP` (80000) — $80,000 annual cap applied to the sum of personal reliefs (not donations).
  - `buildProjection(inputs)` — SRS/brokerage projection engine. Used only by the standalone `/srs` demo page. The main/retirement/accumulation pages do not use this — they derive the SRS pot directly from `buildAccumulation` rows.
  - `buildCpfProjection(inputs)` — CPF account projection engine. Optional `endAge` overrides `cpfWithdrawalAge` as the projection endpoint. Optional `oaDeductions: { age, amount }[]` applies BTO-related OA withdrawals; amounts for the same age are summed, then capped at the available OA balance.
  - `buildBrokerageProjection(inputs)` — investments account projection engine. Takes `contributions: number[]` (one entry per working year, SRS already deducted). Optional `extraExpensesByAge: Map<number, number>` adds per-age extra expenses on top of `annualExpensesToday` in both the drawdown and SRS-active phases — used for retirement-year BTO mortgage cash payments.
  - `recommendedSrsTopUp(income, maxTopUp)` — returns `{ topUp, taxSavings }`: the minimum top-up that drops `income` into the next-lower tax bracket, capped at `maxTopUp`. Returns `{ topUp: 0, taxSavings: 0 }` when already in the 0% bracket or the required amount exceeds `maxTopUp`.
  - `calculateSrsWithdrawal(srsPot, years?)` — returns `{ srsPot, yearlyWithdrawal, taxablePerYear, taxPerYear, totalTax, netFromSrs }`. Only 50% of each withdrawal (`SRS_TAXABLE_FRACTION`) is taxable.
  - `allocateCpfContribution(age, contribution)` — splits CPF contribution into `{ oa, sa, ma }`. Currently covers ages ≤55; a `TODO` marks where above-55 bands should be added.
  - Expense constants: `EXPENSES_INFLATION_RATE` (0.02), `MONTHLY_EXPENSES_TODAY` / `ANNUAL_EXPENSES_TODAY` — dollar constants superseded by `monthlyExpensesToday` from context, but `EXPENSES_INFLATION_RATE` is still imported by pages.
  - SRS constants: `SRS_ANNUAL_CAP` (15300), `CPF_EMPLOYEE_RATE` (0.2), `SRS_WITHDRAWAL_YEARS` (10), `SRS_TAXABLE_FRACTION` (0.5)
  - CPF constants: `CPF_OA_RATE` (0.025), `CPF_SA_RATE` (0.04), `CPF_MA_RATE` (0.04), `CPF_RA_RATE` (0.04), `CPF_TOTAL_CONTRIBUTION_RATE` (0.37), `CPF_FRS_INFLATION_RATE` (0.035 — derived from 2024–2027 CPF Board figures)
- **`lib/cash-flow.ts`** — `buildAccumulation(inputs)` returns one `AccumulationRow` per working year (`age = currentAge + i`). The optional `srsTopUps: number[]` parameter drives per-year SRS deductions; when omitted, no SRS top-up is applied. The optional `taxReliefsPerYear: Record<string, number>[]` parameter applies per-year tax reliefs and donation deductions (see "Cash + accumulation modeling convention"). `AccumulationRow` includes `totalTaxRelief: number` — the combined capped-relief + donation deduction for that year, shown as a sub-line in the tax cell. Used by `/accumulation`, `/main`, and `/retirement`. See "Cash + accumulation modeling convention" below.
- **`lib/projection.ts`** — `buildFullProjection(inputs)`: the full net-worth projection (accumulation → SRS pot → 3-pass CPF → brokerage → networth series, verdict, and `ProjectionSummary`). Consumed by `/main`; keep new cross-page projection logic here.
- **`lib/bto.ts`** — pure BTO compute. Imports `buildCpfProjection` from `lib/tax.ts`. Constants: `HDB_LOAN_RATE` (0.026), `GRANT_CAPS` (`{family: 80000, ehg: 120000, phg: 30000}`), `MAX_TENURE_HDB` (25), `MAX_TENURE_BANK` (30). Exports:
  - `computeBtoBreakdown(inputs, oaAtDp1Age, oaAtDp2Age)` — see "BTO modeling convention" below.
  - `computeMortgageCashPayments(inputs)` — runs the full 3-pass CPF projection internally and returns `{ age, amount }[]` for every mortgage year where the OA balance cannot cover the full annual payment. Only entries with `amount > 0` are returned. Used by `/accumulation` (filters to working years) and `/retirement` (filters to retirement years). At `btoCollectionAge`, DP2 is deducted from OA before the mortgage payment, so available OA = `oa2 - dp2.fromOA`.
  - `getDownpaymentRatios(scheme, loanType)` — returns `{ dp1, dp2 }` ratios; `loanType` overrides scheme ratios for bank loans.
  - `rawGrantSum`, `totalGrantAmount` — `totalGrantAmount` is loan-type aware: bank loans always return `rawGrantSum` (grants always apply regardless of scheme); HDB deferred returns 0 (grants carry to DP2).
  - `effectiveInterestRate`, `maxTenureFor`.
- **`lib/format.ts`** — `fmt` and `fmtMoney` helpers (en-SG locale).
- **`lib/utils.ts`** — `cn()` helper (clsx + tailwind-merge). Used by `components/ui/button.tsx` and any component that needs conditional class merging.
- **`lib/srs-toggle-context.tsx`** — `SrsToggleProvider` + `useSrsToggle` hook. Provides a global `srsEnabled: boolean` toggle distinct from the per-row `srsAccepted[]` array in `ProfileInputs`. Currently wired but not yet surfaced in the main nav pages; check usages before assuming it drives page-level SRS on/off logic.
- **`taxAmount.js`** — original CLI prototype, not imported. Keep `lib/tax.ts` as the source of truth.

### Shared UI

**`app/components/ui.tsx`** — `Slider`, `NumberField`, `StatCard`, `Stat`, `Th`, `Td`, `InfoTooltip`. Import from here rather than redefining per page. `NumberField` accepts an optional `disabled` prop that sets `opacity-40 pointer-events-none` on the wrapper and the native `disabled` attribute on the input — use this to render read-only government-fixed values rather than omitting the field entirely.

**`InfoTooltip`** — hover tooltip that renders via `createPortal` into `document.body`. Use this (not CSS `position: absolute`) whenever a tooltip is inside an `overflow-x-auto` container, because `overflow` clips absolutely-positioned descendants regardless of `z-index`. On `mouseEnter` it reads the icon's `getBoundingClientRect()` and positions the portal with `position: absolute` in page coordinates. A 100 ms hide delay lets the mouse travel from icon to tooltip without it disappearing, making links inside the tooltip clickable.

**`app/components/lumpsum-table.tsx`** — `LumpsumTable` editor for `LumpsumExpense[]` (used for both inflows and expenses). Props: `title`, `description`, `rows`, `onChange`, `totalAccent: "red" | "emerald"`, `idPrefix`, and optional `lockedIds?: Set<string>`. Rows whose `id` is in `lockedIds` render as read-only (static text, "from BTO" badge, no delete button). Purely controlled — owns no state.

**`app/components/lumpsum-tables.tsx`** — composite wrapper used by the inputs panel (`app/components/inputs-panel.tsx`). Exports:
- `useBtoEffectiveExpenses(profileInputs, lumpsumExpenses)` — hook that runs a single-pass CPF projection to look up OA balances, calls `computeBtoBreakdown`, and returns `{ effectiveExpenses, btoLockedIds }`. `effectiveExpenses` overrides `exp-1`/`exp-2` amounts with BTO cash values; `btoLockedIds` is a `Set<string>` passed to `LumpsumTable`.
- `LumpsumTablesPanel` — renders both lumpsum tables side-by-side in a two-column grid, applying BTO overrides and locks automatically.

**`app/components/bto-inputs.tsx`** — `BtoInputsPanel`. Form for all BTO fields, rendered only in the inputs panel (`app/components/inputs-panel.tsx`, inside the BTO / Housing card). Props: `{ draft, setDraft }` — purely controlled. Internally clamps `btoLoanTenureYears` to `maxTenureFor(loanType)` whenever loan type changes.

**`app/components/navbar.tsx`** — slim frosted-glass **top nav bar** (h-14, small `text-sm` links, no bold). Links are split: `PRIMARY_LINKS` (Planner → `/main`) sit left beside the logo; `SECONDARY_LINKS` (SRS Demo → `/srs`, Support Us → `/about`) are pushed right (`ml-auto`) beside the theme toggle. The Planner link is active on any `(planner)` route (`PLANNER_ROUTES`). Active links render as emerald pills. Also owns `useTheme`, which toggles a `dark` class on `<html>` and persists to `localStorage`.

**`app/components/planner-tabs.tsx`** — sub-nav tab pill with two variants. `variant="top"` (default): thin sticky pill above the right pane, desktop-only (`hidden md:flex`). `variant="bottom"`: mobile-only (`md:hidden`) fixed bottom bar (safe-area padded) with stacked icon-over-label items and an extra `INPUTS_TAB` (Inputs → `/inputs`). `PLANNER_TABS`: Networth, Accumulation, BTO, CPF, Retirement — each with a lucide icon. Each planner sub-page also centers its own `<header>` (`text-center`).

**`components/ui/button.tsx`** — `SplitNavButton`. Three-state nav button tracking mouse X position relative to its centre. Default "Cashflow" (routes to `/cashflow`, currently unbuilt); hover-left "Accumulation" (`/accumulation`); hover-right "Retirement" (`/retirement`). Uses `cn()` from `lib/utils.ts`.

**`app/components/footer.tsx`** — site-wide footer rendered in `app/layout.tsx` below `<main>`. Contains copyright line and links to `/terms`, `/privacy`, and `/about`. The layout wraps children in `flex flex-col` so the footer sits flush at the bottom of every page without any page needing to include it explicitly.

**Analytics** — `app/layout.tsx` injects Google Analytics (tag `G-R2YV0686Q1`) and Microsoft Clarity (tag `x09ww0itw3`) via Next.js `<Script strategy="afterInteractive">`. No analytics library is installed; both use inline `gtag`/clarity snippet patterns.

**`app/components/tax-relief-pane.tsx`** — `TaxReliefPane` slideover. Opens when the user clicks a tax cell in the accumulation table. Props: `open`, `rowIndex` (used as a reset key — internal state resets whenever this changes), `age`, `takeHome`, `srsTopUp`, `initialReliefs`, `onClose`, `onSave`. All tax math is recomputed live inside the pane as the user selects reliefs and types amounts. `onSave` receives a `Record<string, number>` of only the selected+non-zero entries (plus `"donation_amount"` if set); the accumulation page writes this directly into `inputs.taxReliefsPerYear[rowIndex]` via `setInputs`. The pane closes on Escape or backdrop click. `InfoTooltip` inside the pane uses a portal so it is not clipped by the pane's `overflow-y-auto` scroll container.

**`app/components/smart-summary.tsx`** — `SmartSummary` slide-over panel used by `/main`. Accepts a `SmartSummaryData` type plus individual props. When `open` is false, both `width` and `height` are set to `0` (not just width) to prevent the hidden text content from inflating the flex row height — `overflow: hidden` alone is not sufficient because zero-width text still wraps to many lines. The parent flex container must use `items-start` (not `items-stretch`) for the same reason.

**`app/components/planner-shell.tsx`** — `PlannerShell` (client). The whole `(planner)` layout body: double-pane on desktop, single-pane on mobile. Reads `usePathname()` — on mobile (`<md`) the inputs pane is CSS-hidden except at `/inputs`, where it becomes a full-width "page" and the right section hides instead. `InputsPanel` is mounted exactly once and never unmounts (only CSS-hidden), so its local draft survives navigation on both breakpoints. Renders `PlannerTabs variant="top"` (desktop, sticky in the right pane) and `variant="bottom"` (mobile, fixed thumb bar); the scroll areas carry `pb-24/pb-28 md:pb-*` so content clears the bottom bar.

### Theme

**Liquid-glass design system.** `app/globals.css` paints a fixed pastel "aurora" backdrop (`body::before` radial gradients + `body::after` SVG wave ribbons) behind every page, and defines two surface utilities: `.glass-card` (floating translucent card — rounded-3xl, backdrop blur, `--glass-*` CSS variables per theme) and `.glass-inset` (nested sub-panel). All page-level section cards and `StatCard`/`Stat` use `.glass-card`/`.glass-inset`; buttons get a global `border-radius: 0.75rem`. Use these utilities instead of flat `border border-foreground/10 bg-foreground/[0.03]` wrappers.

**Light mode is the default.** `app/layout.tsx` has no `dark` class on `<html>`; `useTheme` in `navbar.tsx` defaults to `"light"` and persists the user's choice to `localStorage`. `suppressHydrationWarning` is required on `<html>` because `useTheme` may toggle the class on mount. `app/globals.css` uses Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` follows the class toggle, not `prefers-color-scheme`.

**Colour conventions:** foreground opacity classes use `dark:` variants to darken for dark mode (e.g. `text-foreground/85 dark:text-foreground/60`). Accent colours use `-600`/`-700` shades as the base (light mode) and `-400` shades via `dark:` (e.g. `text-emerald-600 dark:text-emerald-400`).

**CSS custom properties for recharts:** All recharts `stroke`, `fill`, and `stopColor` attributes reference `var(--chart-*)` variables defined in `globals.css` under both `:root` (light) and `.dark`. This is the only way to make SVG presentation attributes theme-aware without JavaScript. The full set: `--chart-total`, `--chart-inv`, `--chart-srs`, `--chart-cpf`, `--chart-cash`, `--chart-no-srs`, `--chart-stop`, `--chart-cpf-ret`, `--chart-cpf-wit`, `--chart-srs-wit`, `--chart-cpf-oa`, `--chart-cpf-sa`, `--chart-cpf-ma`, `--chart-cpf-ra`, `--chart-bto-line`. General UI CSS custom properties (`--axis-color`, `--grid-color`, `--tooltip-bg`) are also defined per theme and referenced as strings in the recharts config.

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
- `donationDeduction = (taxReliefsPerYear[i]["donation_amount"] ?? 0) × 2.5` — outside the $80k cap
- `totalTaxRelief = min(TAX_RELIEF_CAP, sum of all relief amounts except "donation_amount") + donationDeduction`
- `tax = calculateTax(max(0, takeHome - srsTopUp - totalTaxRelief))`
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

- Ratios from `getDownpaymentRatios(scheme, loanType)`. `dp1Amount = flatPrice * dp1Ratio`, `dp2Amount = flatPrice * dp2Ratio`.
- `totalGrant = totalGrantAmount(inputs)` — bank loans always use `rawGrantSum`; HDB deferred returns 0.

**DP1 allocation** — three branches:
- **Bank loan**: `dp1CashFloor = flatPrice * 0.05` for normal/staggered (full `dp1Amount` for deferred, which is all-cash). Flex portion = `dp1Amount − dp1CashFloor`. Grant → OA → cash fills the flex portion; `dp1FromCash = dp1CashFloor + flex shortfall`.
- **HDB deferred**: `dp1FromGrant = 0`, `dp1FromOA = 0`, `dp1FromCash = dp1Amount`. All grants carry forward.
- **HDB normal/staggered**: grant (capped at `dp1Amount`) → OA → cash.

`leftoverGrantAfterDp1 = totalGrant − dp1FromGrant` in all branches.

**DP2 allocation** — unified with optional cash floor:
- `dp2CashFloor = flatPrice * 0.025` for bank deferred; `0` for all other schemes.
- `dp2FlexAmount = dp2Amount − dp2CashFloor`. Grant applied to flex portion only.
- If `leftoverGrant >= dp2FlexAmount`: grant covers all of flex (may overflow); `dp2ActualPaid = dp2CashFloor + leftoverGrant`. Overflow shrinks the loan.
- Otherwise: grant covers partial flex; remainder draws OA → cash; `dp2ActualPaid = dp2Amount`.

- `totalDownpayment = dp1Amount + dp2ActualPaid` (grant overflow inflates totals).
- `loanAmount = max(0, flatPrice − totalDownpayment)`.
- `monthlyMortgage`: standard amortization `P*r(1+r)^n / ((1+r)^n − 1)` with `r = annualRate/12`, `n = tenureYears*12`. Edge case: `r === 0` ⇒ `P/n`. Rate is `HDB_LOAN_RATE` for HDB, `btoBankInterestRate` for bank.
- Mortgage runs from `btoCollectionAge` to `btoCollectionAge + tenureYears − 1`.
- OA balances are looked up from `buildCpfProjection` rows by exact age match; falls back to `cpfOA` when the requested age precedes `currentAge`.

### BTO cash-flow wiring (accumulation + retirement)

BTO affects the cash-flow pages in three layers, each computed on-the-fly (nothing extra is persisted to `ProfileInputs`):

1. **Downpayment cash** — `exp-1` / `exp-2` rows in `lumpsumExpenses` are overridden with `dp1.fromCash` / `dp2.fromCash` via `useBtoEffectiveExpenses` (returns `effectiveExpenses`), on both the accumulation page and the inputs panel. They render as locked rows in the `LumpsumTable` UI (inputs panel only). These feed directly into `buildAccumulation`.

2. **Mortgage cash (working years)** — `computeMortgageCashPayments(inputs)` filtered to `[currentAge, stopWorkingAge)` is appended to the lumpsum expenses list passed to `buildAccumulation` as entries labelled "BTO Mortgage". They show as amber chips in the living-expenses column but do not appear in the editable lumpsum table.

3. **Mortgage cash (retirement years)** — the same `computeMortgageCashPayments` result filtered to `[stopWorkingAge, deathAge]` is converted to a `Map<number, number>` (`retirementMortgageByAge`) and threaded into both `buildWithdrawalRows` (for display) and `buildBrokerageProjection` as `extraExpensesByAge` (for accurate drawdown).

### Projection table — column visibility pattern

Both `/srs` and `/cpf` use: `hiddenCols: Set<ColId>` state + `showHidden` boolean toggle. Clicking a column header opens a per-column dropdown (`openMenu: ColId | null`, closed by a document `mousedown` listener) with "Hide column" / "Remove from hidden". Hidden columns render at 50% opacity when `showHidden` is true.

### NumberField onChange gotcha

`NumberField` fires `onChange` on **every keystroke** using `parseFloat(e.target.value) || 0`. Clearing the field before typing a new value sends `0`. Never use an intermediate `onChange` value to destructively resize or clear an array (e.g. slicing `monthlyExpenseSeries` based on a transient `stopWorkingAge = 0`). Defer array normalisation to an explicit save action (`handleSave` / Recalculate), or guard with a minimum sensible value check.

### Adding a new scheme page

Create `app/(planner)/<name>/page.tsx` (to get the inputs pane + sub-nav shell) and add the route to `PLANNER_TABS` in `app/components/planner-tabs.tsx` with a lucide icon; standalone pages go in `app/(site)/` and, if primary, into `SECONDARY_LINKS` (or `PRIMARY_LINKS`) in `app/components/navbar.tsx`. Put all financial logic in `lib/` rather than in the component. Derive any duration from the age milestone fields rather than storing a raw year count.

### Root layout

**`app/layout.tsx`** wraps every page. `<body>` is `h-screen overflow-hidden flex flex-col` — scrolling is owned by the route group layouts, not the body. Mount order: `ProfileProvider` → `Navbar` (top bar) → `<main className="flex-1 min-h-0">{children}</main>`. `Footer` is rendered by the `(planner)` layout (bottom of the right pane's scroll area) and the `(site)` layout — not here. Analytics scripts (`<Script strategy="afterInteractive">`) are injected here. Add global providers or overlays here, not in individual pages.

### `"use client"` requirement

App Router defaults to Server Components. Every page and component that uses React hooks (`useState`, `useEffect`, `useRef`, `useMemo`, context, etc.) or browser APIs (`localStorage`, `window`) must have `"use client"` as its first line. All current `app/*/page.tsx` files are client components. The only Server Components are `app/page.tsx` (landing page), `app/config/page.tsx` (redirect), and `app/terms/page.tsx` (file read).

## Next.js 16 note

Per `AGENTS.md`, this Next.js version has breaking changes vs. older training data. Consult `node_modules/next/dist/docs/` before changing routing, config, or build setup.
