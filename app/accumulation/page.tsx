"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { buildAccumulation, AccumulationRow } from "@/lib/cash-flow";
import { useProfile, LumpsumExpense } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Td, Th, InfoTooltip } from "@/app/components/ui";
import { LumpsumTablesPanel, useBtoEffectiveExpenses } from "@/app/components/lumpsum-tables";
import { recommendedSrsTopUp, SRS_ANNUAL_CAP, CPF_EMPLOYEE_RATE } from "@/lib/tax";
import { computeMortgageCashPayments } from "@/lib/bto";
import { TaxReliefPane } from "@/app/components/tax-relief-pane";

type LumpsumItem = { name: string; amount: number };

function LivingExpensesCell({
  row,
  lumpsums,
}: {
  row: AccumulationRow;
  lumpsums: LumpsumItem[];
}) {
  const hasBreakdown = lumpsums.length > 0;
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrames = useRef<number[]>([]);

  function show() {
    if (!hasBreakdown) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = tdRef.current?.getBoundingClientRect();
    if (rect) {
      const cardHeight = 48 + lumpsums.length * 24 + 32;
      const cardWidth = 224;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow > cardHeight
          ? rect.bottom + window.scrollY + 6
          : rect.top + window.scrollY - cardHeight - 6;
      const spaceRight = window.innerWidth - rect.left;
      const left =
        spaceRight > cardWidth
          ? rect.left + window.scrollX
          : rect.right + window.scrollX - cardWidth;
      setCoords({ top, left });
    }
    setVisible(true);
    const f1 = requestAnimationFrame(() => {
      const f2 = requestAnimationFrame(() => setEntered(true));
      enterFrames.current.push(f2);
    });
    enterFrames.current.push(f1);
  }

  function hide() {
    enterFrames.current.forEach(cancelAnimationFrame);
    enterFrames.current = [];
    setEntered(false);
    hideTimer.current = setTimeout(() => setVisible(false), 100);
  }

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      enterFrames.current.forEach(cancelAnimationFrame);
    },
    [],
  );

  return (
    <td
      ref={tdRef}
      className="py-2 px-2 whitespace-nowrap"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <div className="flex items-center gap-1.5">
        <span>{fmtMoney(row.livingExpenses)}</span>
        {hasBreakdown && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
        )}
      </div>
      {visible &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
              transition: "opacity 80ms ease, transform 80ms ease",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(-4px)",
            }}
            className="w-56 border border-foreground/15 bg-[var(--tooltip-bg,#0f172a)] p-3 text-xs font-sans shadow-xl pointer-events-auto"
          >
            <div className="text-foreground/75 dark:text-foreground/50 text-[10px] uppercase tracking-wide mb-2">
              Expenses breakdown
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-foreground/85 dark:text-foreground/70">Base living</span>
                <span className="font-mono text-foreground/90">{fmtMoney(row.baseLiving)}</span>
              </div>
              {lumpsums.map((l, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-amber-700 dark:text-amber-300/80 truncate max-w-[120px]">{l.name}</span>
                  <span className="font-mono text-amber-700 dark:text-amber-300 ml-2">+{fmtMoney(l.amount)}</span>
                </div>
              ))}
              <div className="border-t border-foreground/10 pt-1.5 flex justify-between items-center font-semibold">
                <span className="text-foreground/80">Total</span>
                <span className="font-mono">{fmtMoney(row.livingExpenses)}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </td>
  );
}

export default function AccumulationPage() {
  const { inputs, setInputs } = useProfile();

  const [draftExpenses, setDraftExpenses] = useState<LumpsumExpense[]>(inputs.lumpsumExpenses);
  const [draftInflows, setDraftInflows] = useState<LumpsumExpense[]>(inputs.lumpsumInflows);
  const [taxPaneRowIndex, setTaxPaneRowIndex] = useState<number | null>(null);

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

  function handleTaxReliefSave(reliefs: Record<string, number>) {
    if (taxPaneRowIndex === null) return;
    const updated = [...(inputs.taxReliefsPerYear ?? [])];
    while (updated.length <= taxPaneRowIndex) updated.push({});
    updated[taxPaneRowIndex] = reliefs;
    setInputs({ ...inputs, taxReliefsPerYear: updated });
    setTaxPaneRowIndex(null);
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

  const lumpsumBreakdownByAge = useMemo(() => {
    const map = new Map<number, LumpsumItem[]>();
    for (const exp of allAccumulationExpenses) {
      if (exp.amount > 0) {
        const list = map.get(exp.age) ?? [];
        list.push({ name: exp.name, amount: exp.amount });
        map.set(exp.age, list);
      }
    }
    return map;
  }, [allAccumulationExpenses]);

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
        taxReliefsPerYear: inputs.taxReliefsPerYear,
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
      inputs.taxReliefsPerYear,
    ]
  );

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Accumulation Phase
          </h1>
          <p className="text-foreground/85 dark:text-foreground/60 text-sm mt-1">
            Annual income, spending, and cash/investment allocation — age{" "}
            {currentAge} to {stopWorkingAge} ({workingYears} working years).
          </p>
          <p className="text-foreground/75 dark:text-foreground/50 text-xs mt-2">
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-700 dark:text-amber-400/80">Unsaved changes</span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={!isDirty}
            className="px-6 py-3 text-base font-semibold transition-colors
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

      <section className="border border-foreground/10 bg-foreground/[0.03] p-5">
        <h2 className="font-semibold mb-4">Annual accumulation</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/85 dark:text-foreground/60 border-b border-foreground/10">
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
                      Singapore IRAS resident tax brackets. Click any cell to add tax reliefs for that year.{" "}
                      <a
                        href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 dark:text-sky-400 underline hover:text-sky-800 dark:hover:text-sky-300"
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
                const hasInflow = r.lumpsumInflowThisYear > 0;
                const brokerageInsolvent = r.brokerageBalance <= 0;

                const rec = recommendations[i];
                const accepted = i < srsAccepted.length ? srsAccepted[i] : true;

                return (
                  <tr
                    key={r.year}
                    className={`border-b border-foreground/5 ${brokerageInsolvent ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-foreground/[0.04]"}`}
                  >
                    <Td>
                      <div className="flex items-center gap-2">
                        <span>{r.age}</span>
                        {brokerageInsolvent && (
                          <span className="text-[10px] font-sans font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                            ⚠ Debt Alert!
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span>{fmtMoney(r.takeHome)}</span>
                        {hasInflow && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 font-sans whitespace-nowrap">
                            {r.lumpsumInflowName} +{fmtMoney(r.lumpsumInflowThisYear)}
                          </span>
                        )}
                      </div>
                    </Td>

                    {/* SRS top-up column */}
                    <td className="py-2 px-2">
                      {rec.topUp > 0 ? (
                        <div className="flex flex-col items-start gap-0.5 min-w-[172px]">
                          <span className="text-[10px] text-foreground/75 dark:text-foreground/50 font-sans leading-tight">
                            Top up{" "}
                            <span className="text-foreground/85 dark:text-foreground/70">{fmtMoney(rec.topUp)}</span>{" "}
                            to save{" "}
                            <span className="text-emerald-600 dark:text-emerald-400/80">{fmtMoney(rec.taxSavings)}</span>{" "}
                            in taxes?
                          </span>
                          {accepted && (
                            <span className="text-sm text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                              {fmtMoney(rec.topUp)}
                            </span>
                          )}
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              onClick={() => toggleSrs(i, true)}
                              className={`w-6 h-6 text-xs font-bold transition-colors cursor-pointer ${
                                accepted
                                  ? "bg-emerald-500 text-white"
                                  : "bg-foreground/10 text-foreground/65 dark:text-foreground/40 hover:bg-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                              }`}
                              title="Accept SRS top-up"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => toggleSrs(i, false)}
                              className={`w-6 h-6 text-xs font-bold transition-colors cursor-pointer ${
                                !accepted
                                  ? "bg-red-500 text-white"
                                  : "bg-foreground/10 text-foreground/65 dark:text-foreground/40 hover:bg-red-500/40 hover:text-red-700 dark:hover:text-red-300"
                              }`}
                              title="Decline SRS top-up"
                            >
                              ✗
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-foreground/60 dark:text-foreground/30 font-sans">No SRS topups recommended</span>
                      )}
                    </td>

                    <td
                      className="py-2 px-2 whitespace-nowrap cursor-pointer group"
                      onClick={() => setTaxPaneRowIndex(i)}
                    >
                      <div className="flex items-center gap-1.5">
                        <div>
                          <span className="text-red-600 dark:text-red-400">
                            {fmtMoney(r.tax)}
                          </span>
                          {r.totalTaxRelief > 0 && (
                            <span className="block text-[10px] font-sans text-sky-600 dark:text-sky-400">
                              −{fmtMoney(r.totalTaxRelief)} relief
                            </span>
                          )}
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3 h-3 shrink-0 text-foreground/25 group-hover:text-foreground/55 transition-colors"
                        >
                          <path d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L6.226 12.25a2.751 2.751 0 0 1-.892.596l-2.047.848a.75.75 0 0 1-.98-.98l.848-2.047a2.75 2.75 0 0 1 .596-.892l7.262-7.262Z" />
                        </svg>
                      </div>
                    </td>
                    <LivingExpensesCell
                      row={r}
                      lumpsums={lumpsumBreakdownByAge.get(r.age) ?? []}
                    />
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-col leading-tight">
                        <span className={r.cashBalanceBefore < r.cashTarget ? "text-amber-700 dark:text-amber-400" : ""}>
                          {fmtMoney(r.cashBalanceBefore)}
                        </span>
                        <span className="text-[11px] text-foreground/75 dark:text-foreground/50">
                          target: {fmtMoney(r.cashTarget)}
                        </span>
                      </div>
                    </td>
                    <Td className={r.cashTopup < 0 ? "text-red-600 dark:text-red-400" : r.cashTopup > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60 dark:text-foreground/30"}>
                      {r.cashTopup === 0 ? "—" : (r.cashTopup < 0 ? `-${fmtMoney(-r.cashTopup)}` : fmtMoney(r.cashTopup))}
                    </Td>
                    <Td className={r.invested < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-500"}>
                      {r.invested < 0 ? `-${fmtMoney(-r.invested)}` : fmtMoney(r.invested)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <TaxReliefPane
        open={taxPaneRowIndex !== null}
        rowIndex={taxPaneRowIndex}
        age={taxPaneRowIndex !== null ? rows[taxPaneRowIndex]?.age ?? 0 : 0}
        takeHome={taxPaneRowIndex !== null ? rows[taxPaneRowIndex]?.takeHome ?? 0 : 0}
        srsTopUp={taxPaneRowIndex !== null ? rows[taxPaneRowIndex]?.srsTopUp ?? 0 : 0}
        initialReliefs={taxPaneRowIndex !== null ? (inputs.taxReliefsPerYear?.[taxPaneRowIndex] ?? {}) : {}}
        onClose={() => setTaxPaneRowIndex(null)}
        onSave={handleTaxReliefSave}
      />
    </main>
  );
}
