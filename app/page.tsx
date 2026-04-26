"use client";

import { useEffect, useMemo, useState } from "react";
import {
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

const fmt = (n: number) =>
  n.toLocaleString("en-SG", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => `$${fmt(n)}`;

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored =
      (typeof window !== "undefined" &&
        (localStorage.getItem("theme") as "dark" | "light" | null)) ||
      "dark";
    setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  format,
}: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-foreground/80">{label}</span>
        <span className="font-mono text-foreground">
          {format ? format(value) : value}
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
};

function NumberField({
  label,
  value,
  onChange,
  step = 1000,
  prefix,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="block text-sm text-foreground/80 mb-1">{label}</span>
      <div className="flex items-center rounded-md border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500">
        {prefix && (
          <span className="pl-3 text-foreground/60 font-mono">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent px-3 py-2 outline-none font-mono"
        />
      </div>
    </label>
  );
}

export default function Home() {
  const { theme, toggle } = useTheme();

  const [startingSalary, setStartingSalary] = useState(70000);
  const [salaryGrowthRate, setSalaryGrowthRate] = useState(0.02);
  const [investmentGrowthRate, setInvestmentGrowthRate] = useState(0.07);
  const [livingExpensePct, setLivingExpensePct] = useState(0.7);
  const [years, setYears] = useState(30);

  const rows = useMemo(
    () =>
      buildProjection({
        startingSalary,
        salaryGrowthRate,
        investmentGrowthRate,
        livingExpensePct,
        years,
      }),
    [
      startingSalary,
      salaryGrowthRate,
      investmentGrowthRate,
      livingExpensePct,
      years,
    ],
  );

  const final = rows[rows.length - 1];
  const totalTaxSavings = rows.reduce((s, r) => s + r.taxSavings, 0);
  const potDelta = final ? final.potWithSrs - final.potNoSrs : 0;

  const withdrawal = useMemo(
    () => calculateSrsWithdrawal(final?.srsPot ?? 0),
    [final?.srsPot],
  );
  const takeHomeWithSrs =
    (final?.brokeragePotWithSrs ?? 0) + withdrawal.netFromSrs;

  const chartData = rows.map((r) => ({
    year: r.year,
    "With SRS": Math.round(r.potWithSrs),
    "Without SRS": Math.round(r.potNoSrs),
  }));

  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <main className="min-h-screen px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            SG Retirement Dashboard
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            SRS vs no-SRS investment growth over {years} years.
          </p>
        </div>
        <button
          onClick={toggle}
          className="rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/5 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-5">
          <h2 className="font-semibold">Inputs</h2>
          <NumberField
            label="Starting annual salary"
            value={startingSalary}
            onChange={setStartingSalary}
            prefix="$"
            step={1000}
          />
          <Slider
            label="Salary growth rate"
            value={salaryGrowthRate}
            min={0}
            max={0.1}
            step={0.005}
            suffix="%"
            format={(v) => (v * 100).toFixed(1)}
            onChange={setSalaryGrowthRate}
          />
          <Slider
            label="Investment growth rate"
            value={investmentGrowthRate}
            min={0}
            max={0.15}
            step={0.005}
            suffix="%"
            format={(v) => (v * 100).toFixed(1)}
            onChange={setInvestmentGrowthRate}
          />
          <Slider
            label="Living expenses (% of pre-tax income)"
            value={livingExpensePct}
            min={0.1}
            max={0.95}
            step={0.01}
            suffix="%"
            format={(v) => (v * 100).toFixed(0)}
            onChange={setLivingExpensePct}
          />
          <Slider
            label="Years"
            value={years}
            min={5}
            max={40}
            step={1}
            onChange={(v) => setYears(Math.round(v))}
          />
          <p className="text-xs text-foreground/50 leading-relaxed pt-2 border-t border-foreground/10">
            SRS contribution capped at {fmtMoney(SRS_ANNUAL_CAP)}/yr (Singapore
            Citizen). Tax computed on chargeable income only — no other reliefs
            modeled.
          </p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            label="SRS advantage (pre-withdrawal)"
            value={fmtMoney(potDelta)}
            accent="emerald"
          />
          <div className="col-span-2 sm:col-span-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-semibold">Pot growth</h2>
              <span className="text-xs text-foreground/60">
                Total tax saved over {years}y: {fmtMoney(totalTaxSavings)}
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    stroke={axisColor}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: isDark ? "#0f172a" : "#ffffff",
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
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-4">Annual projection</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Yr</Th>
                <Th>Salary</Th>
                <Th>Tax (no SRS)</Th>
                <Th>Tax (w/ SRS)</Th>
                <Th>Tax saved</Th>
                <Th>Invested (no SRS)</Th>
                <Th>Invested (w/ SRS)</Th>
                <Th>Pot (no SRS)</Th>
                <Th>Pot (w/ SRS)</Th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr
                  key={r.year}
                  className="border-b border-foreground/5 hover:bg-foreground/[0.04]"
                >
                  <Td>{r.year}</Td>
                  <Td>{fmtMoney(r.salary)}</Td>
                  <Td>{fmtMoney(r.taxNoSrs)}</Td>
                  <Td>{fmtMoney(r.taxWithSrs)}</Td>
                  <Td className="text-emerald-500">{fmtMoney(r.taxSavings)}</Td>
                  <Td>{fmtMoney(r.investedNoSrs)}</Td>
                  <Td>{fmtMoney(r.investedWithSrs)}</Td>
                  <Td>{fmtMoney(r.potNoSrs)}</Td>
                  <Td className="text-emerald-500">{fmtMoney(r.potWithSrs)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-1">SRS withdrawal</h2>
        <p className="text-xs text-foreground/60 mb-5">
          Pot drawn down over {SRS_WITHDRAWAL_YEARS} years after the
          accumulation period ends. {SRS_TAXABLE_FRACTION * 100}% of each
          withdrawal is taxable as personal income (assumes no other income
          during retirement).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Stat label="SRS pot at retirement" value={fmtMoney(withdrawal.srsPot)} />
          <Stat
            label={`Yearly withdrawal (× ${SRS_WITHDRAWAL_YEARS} yrs)`}
            value={fmtMoney(withdrawal.yearlyWithdrawal)}
          />
          <Stat
            label={`Taxable portion / yr (${SRS_TAXABLE_FRACTION * 100}%)`}
            value={fmtMoney(withdrawal.taxablePerYear)}
          />
          <Stat
            label="Tax per year"
            value={fmtMoney(withdrawal.taxPerYear)}
          />
          <Stat
            label={`Total tax over ${SRS_WITHDRAWAL_YEARS} yrs`}
            value={fmtMoney(withdrawal.totalTax)}
          />
          <Stat
            label="Net from SRS after tax"
            value={fmtMoney(withdrawal.netFromSrs)}
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

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="text-xs text-foreground/60">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold font-mono ${accent === "emerald" ? "text-emerald-500" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
      <div className="text-xs uppercase tracking-wide text-foreground/60">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${accent === "emerald" ? "text-emerald-500" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-foreground/60 mt-1">{sub}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 px-2 font-medium whitespace-nowrap">{children}</th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`py-2 px-2 whitespace-nowrap ${className}`}>{children}</td>
  );
}
