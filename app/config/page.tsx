"use client";

import { useRef, useState } from "react";
import { useProfile, CPF_RATES, ProfileInputs } from "@/lib/profile-context";
import { CPF_EMPLOYEE_RATE } from "@/lib/tax";
import { NumberField, Slider, Th, Td } from "@/app/components/ui";
import { fmtMoney } from "@/lib/format";

function buildDefaultSeries(
  startingSalary: number,
  salaryGrowthRate: number,
  length: number,
): number[] {
  return Array.from(
    { length },
    (_, i) => startingSalary * Math.pow(1 + salaryGrowthRate, i),
  );
}

export default function ConfigPage() {
  const { inputs, setInputs } = useProfile();

  // Local draft — only committed to shared context on Save
  const [draft, setDraft] = useState<ProfileInputs>(inputs);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(inputs);

  const {
    currentAge,
    stopWorkingAge,
    cpfWithdrawalAge,
    cpfRetirementAge,
    deathAge,
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    livingExpensePct,
    srsWithdrawalAge,
    cpfOA,
    cpfSA,
    cpfMA,
    cpfRA,
    cpfLifeFrs,
    cpfLifeMonthlyPayout,
    investmentGrowthRateRetirement,
    salarySeries,
    startingCash,
    monthlyExpensesToday,
  } = draft;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);

  // Display series — always valid length
  const displaySeries =
    salarySeries.length === workingYears
      ? salarySeries
      : buildDefaultSeries(startingSalary, salaryGrowthRate, workingYears);

  // Salary table accordion state
  const [showSalaryTable, setShowSalaryTable] = useState(false);

  // Inline editing state
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  function startEdit(idx: number) {
    setEditIdx(idx);
    setEditVal(String(Math.round(displaySeries[idx])));
  }

  function commitEdit(idx: number) {
    setEditIdx(null);
    const parsed = parseFloat(editVal);
    if (isNaN(parsed) || parsed <= 0) return;
    const newSeries = [...displaySeries];
    for (let j = idx; j < workingYears; j++) {
      newSeries[j] = parsed * Math.pow(1 + salaryGrowthRate, j - idx);
    }
    setDraft({ ...latestDraft.current, salarySeries: newSeries });
  }

  function resetSeries() {
    setDraft({
      ...latestDraft.current,
      salarySeries: buildDefaultSeries(startingSalary, salaryGrowthRate, workingYears),
    });
  }

  function update(key: keyof ProfileInputs) {
    return (v: number) => {
      const next = { ...latestDraft.current, [key]: v };
      if (key === "startingSalary" || key === "salaryGrowthRate" || key === "currentAge" || key === "stopWorkingAge") {
        const wYears = Math.max(0, next.stopWorkingAge - next.currentAge);
        next.salarySeries = buildDefaultSeries(next.startingSalary, next.salaryGrowthRate, wYears);
      }
      setDraft(next);
    };
  }

  function handleSave() {
    setInputs(latestDraft.current);
  }

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Config
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            Your personal financial details — shared across all projection pages.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-400/80">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-6 py-3 rounded-lg text-base font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
          >
            Recalculate
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col gap-8">
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6 space-y-5">
          <div>
            <h2 className="font-semibold">Personal Details</h2>
            <p className="text-foreground/60 text-xs mt-0.5">Your age milestones, salary, and investment assumptions.</p>
          </div>
          <NumberField
            label="Current age"
            value={currentAge}
            onChange={update("currentAge")}
            step={1}
          />
          <NumberField
            label="Stop working age"
            value={stopWorkingAge}
            onChange={update("stopWorkingAge")}
            step={1}
          />
          <NumberField
            label="Death age"
            value={deathAge}
            onChange={update("deathAge")}
            step={1}
          />
          <label className="block">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm text-foreground/80">Starting annual salary</span>
              <div className="relative group">
                <div className="w-4 h-4 rounded-full border border-foreground/40 text-foreground/50 flex items-center justify-center text-[10px] font-semibold cursor-default select-none">
                  i
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 rounded-lg border border-foreground/15 bg-[var(--tooltip-bg)] px-3 py-2 text-xs shadow-lg
                  invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                  <p className="text-foreground/80 font-medium mb-1">CPF Employee Contribution</p>
                  <p className="text-foreground/60">{(CPF_EMPLOYEE_RATE * 100).toFixed(0)}% of gross salary is deducted and paid into your CPF accounts before you receive your take-home pay.</p>
                  <p className="text-foreground font-mono mt-1.5">{fmtMoney(startingSalary * CPF_EMPLOYEE_RATE)}/yr at current salary</p>
                </div>
              </div>
            </div>
            <div className="flex items-center rounded-md border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500">
              <span className="pl-3 text-foreground/60 font-mono">$</span>
              <input
                type="number"
                value={startingSalary}
                step={1000}
                onChange={(e) => update("startingSalary")(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent px-3 py-2 outline-none font-mono"
              />
            </div>
          </label>
          <div>
            <button
              type="button"
              onClick={() => setShowSalaryTable((v) => !v)}
              className="w-full text-left group cursor-pointer"
            >
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="flex items-center gap-1.5 text-foreground/80">
                  Salary growth rate
                  <svg
                    className={`w-3.5 h-3.5 text-foreground/40 transition-transform duration-200 ${showSalaryTable ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
                <span className="font-mono text-foreground">
                  {(salaryGrowthRate * 100).toFixed(1)}%
                </span>
              </div>
            </button>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.005}
              value={salaryGrowthRate}
              onChange={(e) => update("salaryGrowthRate")(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
            {showSalaryTable && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-foreground/60">
                    Click any gross value to edit — rows below cascade automatically.
                  </p>
                  <button
                    onClick={resetSeries}
                    className="text-xs px-2.5 py-1 rounded-md border border-foreground/15 hover:border-foreground/30 text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-foreground/[0.06] backdrop-blur-sm z-10">
                        <tr className="text-left text-foreground/60 border-b border-foreground/10">
                          <Th>Age</Th>
                          <Th>Gross Annual Salary</Th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {displaySeries.map((gross, i) => {
                          const age = currentAge + i;
                          const isEditing = editIdx === i;
                          return (
                            <tr
                              key={age}
                              className="border-b border-foreground/5 hover:bg-foreground/[0.04]"
                            >
                              <Td>{age}</Td>
                              <td className="py-2 px-2 whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editVal}
                                    onChange={(e) => setEditVal(e.target.value)}
                                    onBlur={() => commitEdit(i)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        (e.target as HTMLInputElement).blur();
                                      if (e.key === "Escape") setEditIdx(null);
                                    }}
                                    autoFocus
                                    className="w-40 bg-foreground/10 border border-emerald-500/60 rounded px-2 py-0.5 outline-none text-right"
                                  />
                                ) : (
                                  <button
                                    onClick={() => startEdit(i)}
                                    title="Click to edit"
                                    className="text-right w-40 hover:text-emerald-400 transition-colors cursor-text"
                                  >
                                    {fmtMoney(gross)}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Slider
            label="Investment growth rate"
            value={investmentGrowthRate}
            min={0}
            max={0.15}
            step={0.005}
            suffix="%"
            format={(v) => (v * 100).toFixed(1)}
            onChange={update("investmentGrowthRate")}
          />
          <Slider
            label="Investment growth rate (old) — post-retirement"
            value={investmentGrowthRateRetirement}
            min={0}
            max={0.1}
            step={0.005}
            suffix="%"
            format={(v) => (v * 100).toFixed(1)}
            onChange={update("investmentGrowthRateRetirement")}
          />
          <Slider
            label="Living expenses (% of take-home)"
            value={livingExpensePct}
            min={0.1}
            max={0.95}
            step={0.01}
            suffix="%"
            format={(v) => (v * 100).toFixed(0)}
            onChange={update("livingExpensePct")}
          />
        </div>

        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6 space-y-5">
          <div>
            <h2 className="font-semibold">Retirement Settings</h2>
            <p className="text-foreground/60 text-xs mt-0.5">Spending and withdrawal assumptions used across all retirement projection pages.</p>
          </div>
          <NumberField
            label="Monthly expenses in retirement (today's money)"
            value={monthlyExpensesToday}
            onChange={update("monthlyExpensesToday")}
            prefix="$"
            step={100}
          />
          <div className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm flex justify-between items-center">
            <span className="text-foreground/60">Annual equivalent</span>
            <span className="font-mono text-foreground/80">
              {fmtMoney(monthlyExpensesToday * 12)}/yr
            </span>
          </div>
          <NumberField
            label="SRS withdrawal age"
            value={srsWithdrawalAge}
            onChange={update("srsWithdrawalAge")}
            step={1}
          />
        </div>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6 space-y-5">
          <div>
            <h2 className="font-semibold mb-0.5">CPF Starting Balances</h2>
            <p className="text-foreground/60 text-xs">Enter your current CPF balances. Interest rates are fixed by CPF Board.</p>
          </div>
          <NumberField
            label={`Ordinary Account (OA) — ${(CPF_RATES.OA * 100).toFixed(1)}% p.a.`}
            value={cpfOA}
            onChange={update("cpfOA")}
            prefix="$"
            step={1000}
          />
          <NumberField
            label={`Special Account (SA) — ${(CPF_RATES.SA * 100).toFixed(1)}% p.a.`}
            value={cpfSA}
            onChange={update("cpfSA")}
            prefix="$"
            step={1000}
          />
          <NumberField
            label={`Medisave Account (MA) — ${(CPF_RATES.MA * 100).toFixed(1)}% p.a.`}
            value={cpfMA}
            onChange={update("cpfMA")}
            prefix="$"
            step={1000}
          />
          <NumberField
            label={`Retirement Account (RA) — ${(CPF_RATES.RA * 100).toFixed(1)}% p.a.`}
            value={cpfRA}
            onChange={update("cpfRA")}
            prefix="$"
            step={1000}
          />
          <div className="border-t border-foreground/10 pt-5 space-y-5">
            <div>
              <h2 className="font-semibold mb-0.5">Real Networth Account</h2>
              <p className="text-foreground/60 text-xs">Starting balance in your real networth account today.</p>
            </div>
            <NumberField
              label="Starting cash"
              value={startingCash}
              onChange={update("startingCash")}
              prefix="$"
              step={1000}
            />
          </div>
          <div className="border-t border-foreground/10 pt-5 space-y-5">
            <NumberField
              label="CPF Retirement Account age"
              value={cpfRetirementAge}
              onChange={update("cpfRetirementAge")}
              step={1}
            />
            <NumberField
              label="CPF withdrawal age"
              value={cpfWithdrawalAge}
              onChange={update("cpfWithdrawalAge")}
              step={1}
            />
            <NumberField
              label="CPF LIFE FRS (current)"
              value={cpfLifeFrs}
              onChange={update("cpfLifeFrs")}
              prefix="$"
              step={1000}
            />
            <NumberField
              label="CPF LIFE monthly payout (current)"
              value={cpfLifeMonthlyPayout}
              onChange={update("cpfLifeMonthlyPayout")}
              prefix="$"
              step={10}
            />
          </div>
        </div>
      </div>

    </main>
  );
}
