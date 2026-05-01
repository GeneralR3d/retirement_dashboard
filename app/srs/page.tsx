"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildProjection,
  calculateSrsWithdrawal,
  SRS_ANNUAL_CAP,
  SRS_TAXABLE_FRACTION,
  SRS_WITHDRAWAL_YEARS,
} from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { NumberField, Slider, Stat, StatCard, Td, Th } from "@/app/components/ui";

type ColId =
  | "taxNoSrs"
  | "taxWithSrs"
  | "taxSaved"
  | "investedNoSrs"
  | "investedWithSrs"
  | "pctNoSrs"
  | "pctWithSrs";

const COLS: { id: ColId; label: string }[] = [
  { id: "taxNoSrs",        label: "Tax (no SRS)" },
  { id: "taxWithSrs",      label: "Tax (w/ SRS)" },
  { id: "taxSaved",        label: "Tax saved" },
  { id: "investedNoSrs",   label: "Invested (no SRS)" },
  { id: "investedWithSrs", label: "Invested (w/ SRS)" },
  { id: "pctNoSrs",        label: "% Salary invested (no SRS)" },
  { id: "pctWithSrs",      label: "% Salary invested (w/ SRS)" },
];

type Row = ReturnType<typeof buildProjection>[number];

function cellContent(id: ColId, r: Row): React.ReactNode {
  switch (id) {
    case "taxNoSrs":        return fmtMoney(r.taxNoSrs);
    case "taxWithSrs":      return fmtMoney(r.taxWithSrs);
    case "taxSaved":        return fmtMoney(r.taxSavings);
    case "investedNoSrs":   return fmtMoney(r.investedNoSrs);
    case "investedWithSrs": return fmtMoney(r.investedWithSrs);
    case "pctNoSrs":        return `${((r.investedNoSrs / r.takeHome) * 100).toFixed(1)}%`;
    case "pctWithSrs":      return `${((r.investedWithSrs / r.takeHome) * 100).toFixed(1)}%`;
  }
}

function cellClassName(id: ColId): string {
  if (id === "taxSaved") return "text-emerald-500";
  if (id === "pctNoSrs" || id === "pctWithSrs") return "text-foreground/70";
  return "";
}

function BrokerageTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { balance: number; contribution: number | null } }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const { balance, contribution } = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--tooltip-bg, #0f172a)",
        border: "1px solid var(--grid-color, #1e293b)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 12px",
      }}
    >
      <p className="font-semibold mb-1">Age {label}</p>
      <p className="text-sky-400">Brokerage balance: {fmtMoney(balance)}</p>
      {contribution !== null && <p className="text-foreground/60">Annual contribution: {fmtMoney(contribution)}</p>}
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="w-4 h-4 rounded-full border border-foreground/30 text-foreground/50 hover:text-foreground/80 hover:border-foreground/60 transition-colors flex items-center justify-center text-[10px] font-semibold leading-none ml-1.5"
        aria-label="More information"
      >
        i
      </button>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border border-foreground/15 bg-[var(--tooltip-bg,#0f172a)] shadow-xl px-3 py-2 text-xs text-foreground/80 z-30 pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

export default function SrsPage() {
  // ── Local demo state — fully disconnected from profile context ────────────
  const [currentAge, setCurrentAge] = useState(25);
  const [stopWorkingAge, setStopWorkingAge] = useState(55);
  const [srsWithdrawalAge, setSrsWithdrawalAge] = useState(63);
  const [startingSalary, setStartingSalary] = useState(70000);
  const [salaryGrowthRate, setSalaryGrowthRate] = useState(0.02);
  const [investmentGrowthRate, setInvestmentGrowthRate] = useState(0.07);
  const [investmentGrowthRateRetirement, setInvestmentGrowthRateRetirement] = useState(0.025);
  const [livingExpensePct, setLivingExpensePct] = useState(0.7);

  const years = Math.max(0, srsWithdrawalAge - currentAge);
  const workingYears = Math.min(years, Math.max(0, stopWorkingAge - currentAge));

  const rows = useMemo(
    () =>
      buildProjection({
        startingSalary,
        salaryGrowthRate,
        investmentGrowthRate,
        investmentGrowthRateRetirement,
        livingExpensePct,
        years,
        workingYears,
      }),
    [startingSalary, salaryGrowthRate, investmentGrowthRate, investmentGrowthRateRetirement, livingExpensePct, years, workingYears],
  );

  const final = rows[rows.length - 1];
  const totalTaxSavings = rows.reduce((s, r) => s + r.taxSavings, 0);

  const withdrawal = useMemo(
    () => calculateSrsWithdrawal(final?.srsPot ?? 0),
    [final?.srsPot],
  );
  const takeHomeWithSrs = (final?.brokeragePotWithSrs ?? 0) + withdrawal.netFromSrs;

  const chartData = rows.map((r) => ({
    age: currentAge + r.year,
    "With SRS": Math.round(r.potWithSrs),
    "Without SRS": Math.round(r.potNoSrs),
  }));

  const brokerageAccumulationData = useMemo(() => {
    type Point = { age: number; balance: number; contribution: number | null };
    const result: Point[] = [];
    for (let i = 0; i < years; i++) {
      const r = rows[i];
      result.push({
        age: currentAge + r.year,
        balance: Math.round(r.brokeragePotWithSrs),
        contribution: i < workingYears ? Math.round(r.brokerageWithSrs) : null,
      });
    }
    return result;
  }, [rows, years, workingYears, currentAge]);

  const axisColor = "var(--axis-color, #94a3b8)";
  const gridColor = "var(--grid-color, #1e293b)";

  // ── Column visibility ──────────────────────────────────────────────────────
  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(
    () => new Set<ColId>(["taxNoSrs", "taxWithSrs"]),
  );
  const [showHidden, setShowHidden] = useState(false);
  const [openMenu, setOpenMenu] = useState<ColId | null>(null);
  const thRefs = useRef<Partial<Record<ColId, HTMLTableCellElement>>>({});

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const inAnyTh = Object.values(thRefs.current).some(
        (el) => el && el.contains(e.target as Node),
      );
      if (!inAnyTh) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function toggleHiddenCol(id: ColId) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isVisible(id: ColId) {
    return !hiddenCols.has(id) || showHidden;
  }

  const hiddenCount = hiddenCols.size;

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-foreground/40 mb-1">
          SRS contribution capped at {fmtMoney(SRS_ANNUAL_CAP)}/yr (Singapore
          Citizen) · Tax on chargeable income only, no other reliefs modeled
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Supplementary Retirement Scheme Demo
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          SRS vs no-SRS investment growth from age {currentAge} to {srsWithdrawalAge} ({years} years).
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80 space-y-1.5">
        <p>
          <span className="font-semibold text-amber-400">Projection only</span> — All figures on this page are illustrative comparisons between using SRS and not using SRS. A key assumption is that <span className="font-medium">no withdrawals are made from the brokerage pot before age {srsWithdrawalAge}</span>, which is almost certainly not true in practice.
        </p>
        <p>
          <span className="font-semibold text-amber-400">Disconnected from your profile</span> — The inputs below are local to this page and do not read from or write to your Config. Changes here have no effect on the Overview, Accumulation, Retirement, or CPF pages, and vice versa. This page is a standalone educational tool.
        </p>
        <p>
          <span className="font-semibold text-amber-400">Simplified expense model</span> — Living expenses are modeled as a fixed percentage of take-home salary each year. The per-age monthly expense series and lumpsum events configured in Config are not used here.
        </p>
        <p>
          <span className="font-semibold text-amber-400">No salary series override</span> — Salary grows at a constant rate from the starting salary. The per-age salary table from Config is not applied.
        </p>
      </div>

      {/* ── Demo parameter controls ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <h2 className="font-semibold mb-4">Demo parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">

          {/* Age milestones */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-foreground/40">Age milestones</p>
            <Slider
              label="Current age"
              value={currentAge}
              min={18}
              max={45}
              step={1}
              onChange={(v) => {
                setCurrentAge(v);
                if (stopWorkingAge <= v) setStopWorkingAge(v + 1);
                if (srsWithdrawalAge <= v) setSrsWithdrawalAge(v + 2);
              }}
              format={(v) => `${v} yrs`}
            />
            <Slider
              label="Stop working age"
              value={stopWorkingAge}
              min={currentAge + 1}
              max={70}
              step={1}
              onChange={(v) => {
                setStopWorkingAge(v);
                if (srsWithdrawalAge <= v) setSrsWithdrawalAge(v + 1);
              }}
              format={(v) => `${v} yrs`}
            />
            <Slider
              label="SRS withdrawal age"
              value={srsWithdrawalAge}
              min={Math.max(55, stopWorkingAge + 1)}
              max={75}
              step={1}
              onChange={setSrsWithdrawalAge}
              format={(v) => `${v} yrs`}
            />
          </div>

          {/* Salary */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-foreground/40">Salary</p>
            <NumberField
              label="Starting gross salary"
              value={startingSalary}
              onChange={setStartingSalary}
              step={1000}
              prefix="S$"
            />
            <Slider
              label="Annual salary growth"
              value={salaryGrowthRate}
              min={0}
              max={0.1}
              step={0.005}
              onChange={setSalaryGrowthRate}
              format={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <Slider
              label="Living expenses (% of take-home)"
              value={livingExpensePct}
              min={0}
              max={1}
              step={0.01}
              onChange={setLivingExpensePct}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </div>

          {/* Growth rates */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-foreground/40">Investment growth</p>
            <Slider
              label="Pre-retirement rate"
              value={investmentGrowthRate}
              min={0}
              max={0.15}
              step={0.005}
              onChange={setInvestmentGrowthRate}
              format={(v) => `${(v * 100).toFixed(1)}% p.a.`}
            />
            <Slider
              label="Post-retirement rate"
              value={investmentGrowthRateRetirement}
              min={0}
              max={0.1}
              step={0.005}
              onChange={setInvestmentGrowthRateRetirement}
              format={(v) => `${(v * 100).toFixed(1)}% p.a.`}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Final pot · Without SRS"
          value={fmtMoney(final?.potNoSrs ?? 0)}
        />
        <StatCard
          label="Final pot · With SRS"
          value={fmtMoney(final?.potWithSrs ?? 0)}
          accent="emerald"
        />
        <StatCard
          label="Take-home · With SRS (post-withdrawal)"
          value={fmtMoney(takeHomeWithSrs)}
          sub={`${(((takeHomeWithSrs - (final?.potNoSrs ?? 0)) / Math.max(1, final?.potNoSrs ?? 1)) * 100 >= 0 ? "+" : "")}${(((takeHomeWithSrs - (final?.potNoSrs ?? 0)) / Math.max(1, final?.potNoSrs ?? 1)) * 100).toFixed(1)}% vs no-SRS`}
          accent="emerald"
        />
        <StatCard
          label="SRS advantage (post-withdrawal)"
          value={fmtMoney(takeHomeWithSrs - (final?.potNoSrs ?? 0))}
          accent="emerald"
        />
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold flex items-center">
            Pot growth
            <InfoTooltip text={`Investment grows at ${(investmentGrowthRate * 100).toFixed(1)}% p.a. during working years (age ${currentAge}–${stopWorkingAge}), then switches to ${(investmentGrowthRateRetirement * 100).toFixed(1)}% p.a. after retirement to reflect lower risk tolerance.`} />
          </h2>
          <span className="text-xs text-foreground/60">
            Total tax saved (age {currentAge}–{srsWithdrawalAge}): {fmtMoney(totalTaxSavings)}
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="age" stroke={axisColor} tick={{ fontSize: 12 }} label={{ value: "Age", position: "insideBottomRight", offset: -5, fontSize: 11, fill: axisColor }} />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg, #0f172a)",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => fmtMoney(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="With SRS"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Without SRS"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold flex items-center">
            Brokerage pot — accumulation
            <InfoTooltip text={`Contributions from age ${currentAge}–${stopWorkingAge} growing at ${(investmentGrowthRate * 100).toFixed(1)}% p.a. After retirement the pot continues to grow at ${(investmentGrowthRateRetirement * 100).toFixed(1)}% p.a. with no withdrawals assumed until age ${srsWithdrawalAge}.`} />
          </h2>
          <span className="text-xs text-foreground/60">
            Hover for annual contribution
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={brokerageAccumulationData}
              margin={{ top: 28, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="brokerageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="age" stroke={axisColor} tick={{ fontSize: 12 }} label={{ value: "Age", position: "insideBottomRight", offset: -5, fontSize: 11, fill: axisColor }} />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<BrokerageTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                name="Brokerage balance"
                stroke="#38bdf8"
                strokeWidth={2.5}
                fill="url(#brokerageGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Annual projection</h2>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-md border border-foreground/15 hover:border-foreground/30 text-foreground/60 hover:text-foreground transition-colors"
            >
              {showHidden
                ? "Hide hidden columns"
                : `Show ${hiddenCount} hidden column${hiddenCount > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                <Th>Take-home</Th>
                {COLS.map((col) =>
                  isVisible(col.id) ? (
                    <th
                      key={col.id}
                      ref={(el) => {
                        if (el) thRefs.current[col.id] = el;
                      }}
                      className="py-2 px-2 font-medium whitespace-nowrap relative select-none"
                    >
                      <button
                        onClick={() =>
                          setOpenMenu((prev) =>
                            prev === col.id ? null : col.id,
                          )
                        }
                        className={`flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors ${
                          hiddenCols.has(col.id) ? "text-amber-400/70" : ""
                        }`}
                      >
                        {col.label}
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {openMenu === col.id && (
                        <div className="absolute top-full left-0 mt-1 z-20 rounded-lg border border-foreground/15 bg-[var(--tooltip-bg,#0f172a)] shadow-xl py-1 min-w-[160px]">
                          <button
                            onClick={() => {
                              toggleHiddenCol(col.id);
                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-foreground/10 transition-colors"
                          >
                            {hiddenCols.has(col.id)
                              ? "Remove from hidden"
                              : "Hide column"}
                          </button>
                        </div>
                      )}
                    </th>
                  ) : null,
                )}
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr
                  key={r.year}
                  className="border-b border-foreground/5 hover:bg-foreground/[0.04]"
                >
                  <Td>{currentAge + r.year}</Td>
                  <Td>{fmtMoney(r.takeHome)}</Td>
                  {COLS.map((col) =>
                    isVisible(col.id) ? (
                      <Td
                        key={col.id}
                        className={
                          hiddenCols.has(col.id)
                            ? "opacity-50 " + cellClassName(col.id)
                            : cellClassName(col.id)
                        }
                      >
                        {cellContent(col.id, r)}
                      </Td>
                    ) : null,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-1">SRS withdrawal</h2>
        <p className="text-xs text-foreground/60 mb-5">
          Pot drawn down over {SRS_WITHDRAWAL_YEARS} years after the
          accumulation period ends. {SRS_TAXABLE_FRACTION * 100}% of each
          withdrawal is taxable as personal income (assumes no other income
          during retirement).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Stat label={`SRS pot at age ${srsWithdrawalAge}`} value={fmtMoney(withdrawal.srsPot)} />
          <Stat
            label={`Yearly withdrawal (× ${SRS_WITHDRAWAL_YEARS} yrs)`}
            value={fmtMoney(withdrawal.yearlyWithdrawal)}
          />
          <Stat
            label={`Taxable portion / yr (${SRS_TAXABLE_FRACTION * 100}%)`}
            value={fmtMoney(withdrawal.taxablePerYear)}
          />
          <Stat label="Tax per year" value={fmtMoney(withdrawal.taxPerYear)} />
          <Stat
            label={`Total tax over ${SRS_WITHDRAWAL_YEARS} yrs`}
            value={fmtMoney(withdrawal.totalTax)}
          />
          <Stat
            label="Net from SRS after tax"
            value={fmtMoney(withdrawal.netFromSrs)}
            accent="emerald"
          />
          <Stat
            label={`Annual SRS income (÷ ${SRS_WITHDRAWAL_YEARS} yrs)`}
            value={fmtMoney(withdrawal.netFromSrs / SRS_WITHDRAWAL_YEARS)}
            accent="emerald"
          />
        </div>
        <div className="mt-5 pt-5 border-t border-foreground/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Brokerage pot (with SRS scenario)"
            value={fmtMoney(final?.brokeragePotWithSrs ?? 0)}
          />
          <Stat
            label="+ Net SRS after withdrawal tax"
            value={fmtMoney(withdrawal.netFromSrs)}
          />
          <Stat
            label="= Final take-home pot"
            value={fmtMoney(takeHomeWithSrs)}
            accent="emerald"
          />
        </div>
      </section>
    </main>
  );
}
