"use client";

import { useMemo, useState } from "react";
import { buildAccumulation } from "@/lib/cash-flow";
import { useProfile, LumpsumExpense } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Td, Th, InfoTooltip } from "@/app/components/ui";
import { LumpsumTablesPanel, useBtoEffectiveExpenses } from "@/app/components/lumpsum-tables";
import { recommendedSrsTopUp, SRS_ANNUAL_CAP, CPF_EMPLOYEE_RATE } from "@/lib/tax";
import { computeMortgageCashPayments } from "@/lib/bto";

export default function AccumulationPage() {
  const { inputs, setInputs } = useProfile();

  const [draftExpenses, setDraftExpenses] = useState<LumpsumExpense[]>(inputs.lumpsumExpenses);
  const [draftInflows, setDraftInflows] = useState<LumpsumExpense[]>(inputs.lumpsumInflows);

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

  const { effectiveExpenses: effectiveDraftExpenses } = useBtoEffectiveExpenses(inputs, draftExpenses);

  // Mortgage cash payments for working years — injected into buildAccumulation but NOT
  // shown in the lumpsum table (there can be 25+ years, which would clutter the UI).
  const mortgageCashPayments = useMemo(
    () => computeMortgageCashPayments(inputs),
    [inputs],
  );

  const workingYearMortgageLumpsums = useMemo(
    () =>
      mortgageCashPayments
        .filter((p) => p.age >= currentAge && p.age < stopWorkingAge)
        .map((p) => ({ id: `bto-mtg-${p.age}`, age: p.age, name: "BTO Mortgage", amount: p.amount })),
    [mortgageCashPayments, currentAge, stopWorkingAge],
  );

  // All expenses fed to buildAccumulation: user draft (with BTO DP overrides) + mortgage cash
  const allAccumulationExpenses = useMemo(
    () => [...effectiveDraftExpenses, ...workingYearMortgageLumpsums],
    [effectiveDraftExpenses, workingYearMortgageLumpsums],
  );

  const isDirty =
    JSON.stringify(effectiveDraftExpenses) !== JSON.stringify(inputs.lumpsumExpenses) ||
    JSON.stringify(draftInflows) !== JSON.stringify(inputs.lumpsumInflows);

  function handleRecalculate() {
    setInputs({
      ...inputs,
      lumpsumExpenses: effectiveDraftExpenses,
      lumpsumInflows: draftInflows,
    });
  }

  // srsAccepted lives in profile context so it persists across navigation.
  // [] means all-accepted; missing indices also default to true.
  const srsAccepted = inputs.srsAccepted;

  function toggleSrs(index: number, accepted: boolean) {
    const base =
      srsAccepted.length === workingYears
        ? [...srsAccepted]
        : Array.from({ length: workingYears }, (_, i) =>
            i < srsAccepted.length ? srsAccepted[i] : true
          );
    base[index] = accepted;
    setInputs({ ...inputs, srsAccepted: base });
  }

  // Recommended SRS top-up per year (based on salary only, independent of brokerage state)
  const recommendations = useMemo(
    () =>
      Array.from({ length: workingYears }, (_, i) => {
        const salary =
          salarySeries?.length === workingYears
            ? salarySeries[i]
            : startingSalary * Math.pow(1 + salaryGrowthRate, i);
        const takeHome = salary * (1 - CPF_EMPLOYEE_RATE);
        return recommendedSrsTopUp(takeHome, SRS_ANNUAL_CAP);
      }),
    [workingYears, salarySeries, startingSalary, salaryGrowthRate]
  );

  const srsTopUps = useMemo(
    () =>
      recommendations.map((rec, i) => {
        const accepted = i < srsAccepted.length ? srsAccepted[i] : true;
        return accepted ? rec.topUp : 0;
      }),
    [recommendations, srsAccepted]
  );

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
        lumpsumExpenses: allAccumulationExpenses,
        lumpsumInflows: draftInflows,
        cashStart: cash,
        brokerageStart: startingCash,
        investmentGrowthRate,
        srsTopUps,
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
      allAccumulationExpenses,
      draftInflows,
      cash,
      startingCash,
      investmentGrowthRate,
      workingYears,
      srsTopUps,
    ]
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
              disabled:cursor-not-allowed cursor-pointer
              bg-emerald-600 hover:bg-emerald-500 text-white shadow-md
              disabled:bg-foreground/15 disabled:text-foreground/30 disabled:shadow-none"
          >
            Recalculate
          </button>
        </div>
      </header>

      {/* Lumpsum tables (synced with config) */}
      <div className="mb-6">
        <LumpsumTablesPanel
          profileInputs={inputs}
          lumpsumExpenses={draftExpenses}
          lumpsumInflows={draftInflows}
          onExpensesChange={setDraftExpenses}
          onInflowsChange={setDraftInflows}
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
                    SRS top-up
                    <InfoTooltip>
                      SRS top-ups are only recommended when the contribution moves you into a lower tax bracket. 
                    </InfoTooltip>
                  </span>
                </Th>
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
                <Th>
                  <div>Cash on hand </div>
                  <div>(actual / target)</div>
                </Th>
                <Th>Cash topup</Th>
                <Th>Investments topup</Th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r, i) => {
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

                const rec = recommendations[i];
                const accepted = i < srsAccepted.length ? srsAccepted[i] : true;

                return (
                  <tr
                    key={r.year}
                    className={`border-b border-foreground/5 ${rowClass}`}
                  >
                    <Td>
                      <div className="flex items-center gap-2">
                        <span>{r.age}</span>
                        {brokerageInsolvent && (
                          <span className="text-[10px] font-sans font-semibold text-red-400 whitespace-nowrap">
                            ⚠ Debt Alert!
                          </span>
                        )}
                      </div>
                    </Td>
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

                    {/* SRS top-up column */}
                    <td className="py-2 px-2">
                      {rec.topUp > 0 ? (
                        <div className="flex flex-col items-start gap-0.5 min-w-[172px]">
                          <span className="text-[10px] text-foreground/50 font-sans leading-tight">
                            Top up{" "}
                            <span className="text-foreground/70">{fmtMoney(rec.topUp)}</span>{" "}
                            to save{" "}
                            <span className="text-emerald-400/80">{fmtMoney(rec.taxSavings)}</span>{" "}
                            in taxes?
                          </span>
                          {accepted && (
                            <span className="text-sm text-emerald-300 whitespace-nowrap">
                              {fmtMoney(rec.topUp)}
                            </span>
                          )}
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              onClick={() => toggleSrs(i, true)}
                              className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                                accepted
                                  ? "bg-emerald-500 text-white"
                                  : "bg-foreground/10 text-foreground/40 hover:bg-emerald-500/40 hover:text-emerald-300"
                              }`}
                              title="Accept SRS top-up"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => toggleSrs(i, false)}
                              className={`w-6 h-6 rounded text-xs font-bold transition-colors cursor-pointer ${
                                !accepted
                                  ? "bg-red-500 text-white"
                                  : "bg-foreground/10 text-foreground/40 hover:bg-red-500/40 hover:text-red-300"
                              }`}
                              title="Decline SRS top-up"
                            >
                              ✗
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-foreground/30 font-sans">No SRS topups recommended</span>
                      )}
                    </td>

                    <Td className="text-red-400">{fmtMoney(r.tax)}</Td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-col items-start leading-tight gap-0.5">
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
