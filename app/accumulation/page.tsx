"use client";

import { useMemo } from "react";
import { buildProjection } from "@/lib/tax";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Td, Th } from "@/app/components/ui";

export default function AccumulationPage() {
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

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Accumulation Phase
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Annual income and spending breakdown — age {currentAge} to{" "}
          {stopWorkingAge} ({workingYears} working years).
        </p>
      </header>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-4">Annual accumulation</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                <Th>Take-home salary</Th>
                <Th>Tax paid (no SRS)</Th>
                <Th>Living expenses</Th>
                <Th>Housing (HDB/condo) morgage</Th>
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
