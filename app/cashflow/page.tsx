"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildProjection } from "@/lib/tax";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Td, Th } from "@/app/components/ui";

export default function CashflowPage() {
  const { inputs } = useProfile();
  const {
    currentAge,
    stopWorkingAge,
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    investmentGrowthRateRetirement,
    livingExpensePct,
    salarySeries,
  } = inputs;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);

  const rows = useMemo(
    () =>
      buildProjection({
        startingSalary,
        salaryGrowthRate,
        investmentGrowthRate,
        investmentGrowthRateRetirement,
        livingExpensePct,
        years: workingYears,
        workingYears,
        salarySeries:
          salarySeries.length === workingYears ? salarySeries : undefined,
      }),
    [
      startingSalary,
      salaryGrowthRate,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      livingExpensePct,
      workingYears,
      salarySeries,
    ],
  );

  const totalTakeHome = rows.reduce((s, r) => s + r.takeHome, 0 as number);
  const totalTax = rows.reduce((s, r) => s + r.taxNoSrs, 0 as number);
  const totalLiving = rows.reduce((s, r) => s + r.livingExpenses, 0 as number);
  const totalLeftover = rows.reduce((s, r) => s + r.investedNoSrs, 0 as number);

  const chartData = rows.map((r: (typeof rows)[number]) => ({
    age: currentAge + r.year,
    Tax: Math.round(r.taxNoSrs),
    "Living expenses": Math.round(r.livingExpenses),
    Housing: 0,
    "Leftover for investments": Math.round(r.investedNoSrs),
  }));

  const axisColor = "var(--axis-color, #94a3b8)";
  const gridColor = "var(--grid-color, #1e293b)";

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Cashflow
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Annual income and spending breakdown — age {currentAge} to{" "}
          {stopWorkingAge} ({workingYears} working years).
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total take-home" value={fmtMoney(totalTakeHome)} />
        <StatCard
          label="Total tax paid"
          value={fmtMoney(totalTax)}
          sub={`${((totalTax / Math.max(1, totalTakeHome)) * 100).toFixed(1)}% of take-home`}
        />
        <StatCard
          label="Total living expenses"
          value={fmtMoney(totalLiving)}
          sub={`${((totalLiving / Math.max(1, totalTakeHome)) * 100).toFixed(1)}% of take-home`}
        />
        <StatCard
          label="Total leftover for investments"
          value={fmtMoney(totalLeftover)}
          sub={`${((totalLeftover / Math.max(1, totalTakeHome)) * 100).toFixed(1)}% of take-home`}
          accent="emerald"
        />
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <h2 className="font-semibold mb-4">Cashflow breakdown</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="age"
                stroke={axisColor}
                tick={{ fontSize: 11 }}
                label={{
                  value: "Age",
                  position: "insideBottomRight",
                  offset: -5,
                  fontSize: 11,
                  fill: axisColor,
                }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg, #0f172a)",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => fmtMoney(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Tax" stackId="a" fill="#f87171" radius={0} />
              <Bar dataKey="Living expenses" stackId="a" fill="#fbbf24" radius={0} />
              <Bar dataKey="Housing" stackId="a" fill="#64748b" radius={0} />
              <Bar
                dataKey="Leftover for investments"
                stackId="a"
                fill="#34d399"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-4">Annual cashflow</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                <Th>Take-home salary</Th>
                <Th>Tax paid</Th>
                <Th>Living expenses</Th>
                <Th>Housing (HDB/condo)</Th>
                <Th>Leftover for investments</Th>
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
                  <Td className="text-red-400">{fmtMoney(r.taxNoSrs)}</Td>
                  <Td>{fmtMoney(r.livingExpenses)}</Td>
                  <Td className="text-foreground/30">—</Td>
                  <Td className="text-emerald-500">{fmtMoney(r.investedNoSrs)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-foreground/20 text-foreground/70 font-semibold">
                <Td>Total</Td>
                <Td>{fmtMoney(totalTakeHome)}</Td>
                <Td className="text-red-400">{fmtMoney(totalTax)}</Td>
                <Td>{fmtMoney(totalLiving)}</Td>
                <Td className="text-foreground/30">—</Td>
                <Td className="text-emerald-500">{fmtMoney(totalLeftover)}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
