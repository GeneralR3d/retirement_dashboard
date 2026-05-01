"use client";

import { useMemo, useState } from "react";
import { buildAccumulation } from "@/lib/cash-flow";
import { useProfile, LumpsumExpense } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Td, Th, InfoTooltip } from "@/app/components/ui";
import { LumpsumTable } from "@/app/components/lumpsum-table";

export default function AccumulationPage() {
  const { inputs, setInputs } = useProfile();

  // Local drafts for the two tables — only committed on Recalculate
  const [draftExpenses, setDraftExpenses] = useState<LumpsumExpense[]>(inputs.lumpsumExpenses);
  const [draftInflows, setDraftInflows] = useState<LumpsumExpense[]>(inputs.lumpsumInflows);

  const isDirty =
    JSON.stringify(draftExpenses) !== JSON.stringify(inputs.lumpsumExpenses) ||
    JSON.stringify(draftInflows) !== JSON.stringify(inputs.lumpsumInflows);

  function handleRecalculate() {
    setInputs({
      ...inputs,
      lumpsumExpenses: draftExpenses,
      lumpsumInflows: draftInflows,
    });
  }

  const {
    currentAge,
    stopWorkingAge,
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    salarySeries,
    monthlyExpensesToday,
    monthlyExpenseSeries,
    emergencyMonths,
    lumpsumExpenses,
    lumpsumInflows,
    cash,
    startingCash,
  } = inputs;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);

  const rows = useMemo(
    () =>
      buildAccumulation({
        currentAge,
        stopWorkingAge,
        startingSalary,
        salaryGrowthRate,
        salarySeries:
          salarySeries.length === workingYears ? salarySeries : undefined,
        monthlyExpensesToday,
        monthlyExpenseSeries:
          monthlyExpenseSeries.length === workingYears
            ? monthlyExpenseSeries
            : undefined,
        emergencyMonths,
        lumpsumExpenses,
        lumpsumInflows,
        cashStart: cash,
        brokerageStart: startingCash,
        investmentGrowthRate,
      }),
    [
      currentAge,
      stopWorkingAge,
      startingSalary,
      salaryGrowthRate,
      salarySeries,
      monthlyExpensesToday,
      monthlyExpenseSeries,
      emergencyMonths,
      lumpsumExpenses,
      lumpsumInflows,
      cash,
      startingCash,
      investmentGrowthRate,
      workingYears,
    ],
  );

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Accumulation Phase
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            Annual income, spending, and cash/investment allocation — age{" "}
            {currentAge} to {stopWorkingAge} ({workingYears} working years).
          </p>
          <p className="text-foreground/50 text-xs mt-2">
            Edit lumpsum tables below — click Recalculate to apply. Living-expense
            and cash-target settings live on the Config page. Inflow years are
            highlighted in emerald, expense years in amber.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-400/80">Unsaved changes</span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={!isDirty}
            className="px-6 py-3 rounded-lg text-base font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
          >
            Recalculate
          </button>
        </div>
      </header>

      {/* Lumpsum tables (synced with config) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LumpsumTable
          title="Lumpsum Inflows"
          description="One-time inflows (inheritance, bonuses, etc.) added to that year's available cash."
          rows={draftInflows}
          onChange={setDraftInflows}
          totalAccent="emerald"
          idPrefix="inflow"
        />
        <LumpsumTable
          title="Lumpsum Expenses"
          description="One-time expenses applied at a specific age. Added on top of the monthly living expenses for that year."
          rows={draftExpenses}
          onChange={setDraftExpenses}
          totalAccent="red"
          idPrefix="exp"
        />
      </div>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-4">Annual accumulation</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                <Th>Take-home salary</Th>
                <Th>
                  <span className="flex items-center gap-1">
                    Tax
                    <InfoTooltip>
                      Tax rates follow Singapore IRAS resident tax brackets.{" "}
                      <a
                        href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 underline hover:text-sky-300"
                      >
                        View rates on IRAS
                      </a>
                    </InfoTooltip>
                  </span>
                </Th>
                <Th>Living expenses</Th>
                <Th>Cash on hand (actual / target)</Th>
                <Th>Cash topup</Th>
                <Th>Investments topup</Th>
                <Th>Investments balance</Th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => {
                const hasExpense = r.lumpsumThisYear > 0;
                const hasInflow = r.lumpsumInflowThisYear > 0;
                const brokerageInsolvent = r.brokerageBalance <= 0;
                const rowClass = brokerageInsolvent
                  ? "bg-red-500/10 hover:bg-red-500/15"
                  : hasExpense && hasInflow
                    ? "bg-gradient-to-r from-emerald-500/10 to-amber-500/10 hover:from-emerald-500/15 hover:to-amber-500/15"
                    : hasExpense
                      ? "bg-amber-500/10 hover:bg-amber-500/15"
                      : hasInflow
                        ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "hover:bg-foreground/[0.04]";
                return (
                  <tr
                    key={r.year}
                    className={`border-b border-foreground/5 ${rowClass}`}
                  >
                    <Td>{r.age}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span>{fmtMoney(r.takeHome)}</span>
                        {hasInflow && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-sans whitespace-nowrap">
                            {r.lumpsumInflowName} +{fmtMoney(r.lumpsumInflowThisYear)}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-red-400">{fmtMoney(r.tax)}</Td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{fmtMoney(r.livingExpenses)}</span>
                        {hasExpense && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 font-sans whitespace-nowrap">
                            {r.lumpsumName} +{fmtMoney(r.lumpsumThisYear)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-col leading-tight">
                        <span className={r.cashBalance < r.cashTarget ? "text-amber-400" : ""}>
                          {fmtMoney(r.cashBalance)}
                        </span>
                        <span className="text-[11px] text-foreground/50">
                          target: {fmtMoney(r.cashTarget)}
                        </span>
                      </div>
                    </td>
                    <Td className={r.cashTopup < 0 ? "text-red-400" : r.cashTopup > 0 ? "text-emerald-400" : "text-foreground/30"}>
                      {r.cashTopup === 0 ? "—" : (r.cashTopup < 0 ? `-${fmtMoney(-r.cashTopup)}` : fmtMoney(r.cashTopup))}
                    </Td>
                    <Td className={r.invested < 0 ? "text-red-400" : "text-emerald-500"}>
                      {r.invested < 0 ? `-${fmtMoney(-r.invested)}` : fmtMoney(r.invested)}
                    </Td>
                    <Td className={r.brokerageBalance <= 0 ? "text-red-400 font-semibold" : "text-foreground/80"}>
                      {r.brokerageBalance <= 0 && <span className="mr-1">⚠</span>}
                      {fmtMoney(r.brokerageBalance)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
