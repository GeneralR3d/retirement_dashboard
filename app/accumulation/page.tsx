"use client";

import { useMemo, useState } from "react";
import { buildProjection } from "@/lib/tax";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Td, Th } from "@/app/components/ui";

type LumpsumRow = { id: string; age: number; name: string; amount: number };

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

  const [inflows, setInflows] = useState<LumpsumRow[]>([
    { id: "inflow-1", age: 0, name: "Inheritance", amount: 0 },
    { id: "inflow-2", age: 0, name: "TOTO", amount: 0 },
  ]);

  const [lumpsumExpenses, setLumpsumExpenses] = useState<LumpsumRow[]>([
    { id: "exp-1", age: 0, name: "BTO Downpayment (application)", amount: 0 },
    { id: "exp-2", age: 0, name: "BTO Downpayment (key collection)", amount: 0 },
    { id: "exp-3", age: 0, name: "Wedding", amount: 0 },
    { id: "exp-4", age: 0, name: "Renovation", amount: 0 },
    { id: "exp-5", age: 0, name: "Honeymoon", amount: 0 },
    { id: "exp-6", age: 0, name: "Car Downpayment", amount: 0 },
  ]);

  function updateRow(
    setter: React.Dispatch<React.SetStateAction<LumpsumRow[]>>,
    id: string,
    field: keyof LumpsumRow,
    value: string | number,
  ) {
    setter((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function addRow(setter: React.Dispatch<React.SetStateAction<LumpsumRow[]>>) {
    setter((rows) => [
      ...rows,
      { id: `row-${Date.now()}`, age: 0, name: "", amount: 0 },
    ]);
  }

  function removeRow(
    setter: React.Dispatch<React.SetStateAction<LumpsumRow[]>>,
    id: string,
  ) {
    setter((rows) => rows.filter((r) => r.id !== id));
  }

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

      {/* Lumpsum tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Lumpsum Inflows */}
        <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Lumpsum Inflows</h2>
            <button
              onClick={() => addRow(setInflows)}
              className="text-xs px-2.5 py-1 rounded-md border border-foreground/15 hover:border-emerald-500/50 hover:text-emerald-400 text-foreground/60 transition-colors cursor-pointer"
            >
              + Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/60 border-b border-foreground/10">
                  <Th>Age</Th>
                  <Th>Name</Th>
                  <Th>Amount</Th>
                  <th className="py-2 px-2 w-6" />
                </tr>
              </thead>
              <tbody className="font-mono">
                {inflows.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/5 hover:bg-foreground/[0.04]">
                    <td className="py-2 px-2 w-16">
                      <input
                        type="number"
                        value={r.age}
                        min={currentAge}
                        max={stopWorkingAge}
                        step={1}
                        onChange={(e) => updateRow(setInflows, r.id, "age", parseInt(e.target.value) || currentAge)}
                        className="w-14 bg-foreground/10 border border-foreground/15 rounded-lg px-2 py-0.5 outline-none focus:border-emerald-500 text-center"
                      />
                    </td>
                    <td className="py-2 px-2 whitespace-normal break-words min-w-0">
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(setInflows, r.id, "name", e.target.value)}
                        className="w-full bg-transparent outline-none border-b border-transparent hover:border-foreground/20 focus:border-emerald-500 px-1 py-0.5 transition-colors whitespace-normal break-words"
                      />
                    </td>
                    <td className="py-2 pr-1 pl-2">
                      <div className="flex items-center rounded-xl border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500 w-24">
                        <span className="pl-2 text-foreground/50 text-xs">$</span>
                        <input
                          type="number"
                          value={r.amount}
                          step={1000}
                          min={0}
                          onChange={(e) => updateRow(setInflows, r.id, "amount", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent px-2 py-1.5 outline-none text-sm"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => removeRow(setInflows, r.id)}
                        className="text-foreground/30 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.04] font-medium">
                  <td className="py-2 px-2 text-xs text-foreground/50 col-span-2" colSpan={2}>Total</td>
                  <td className="py-2 px-2 font-mono text-sm text-emerald-400">
                    {fmtMoney(inflows.reduce((s, r) => s + r.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Lumpsum Expenses */}
        <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Lumpsum Expenses</h2>
            <button
              onClick={() => addRow(setLumpsumExpenses)}
              className="text-xs px-2.5 py-1 rounded-md border border-foreground/15 hover:border-emerald-500/50 hover:text-emerald-400 text-foreground/60 transition-colors cursor-pointer"
            >
              + Add row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/60 border-b border-foreground/10">
                  <Th>Age</Th>
                  <Th>Name</Th>
                  <Th>Amount</Th>
                  <th className="py-2 px-2 w-6" />
                </tr>
              </thead>
              <tbody className="font-mono">
                {lumpsumExpenses.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/5 hover:bg-foreground/[0.04]">
                    <td className="py-2 px-2 w-16">
                      <input
                        type="number"
                        value={r.age}
                        min={currentAge}
                        max={stopWorkingAge}
                        step={1}
                        onChange={(e) => updateRow(setLumpsumExpenses, r.id, "age", parseInt(e.target.value) || currentAge)}
                        className="w-14 bg-foreground/10 border border-foreground/15 rounded-lg px-2 py-0.5 outline-none focus:border-emerald-500 text-center"
                      />
                    </td>
                    <td className="py-2 px-2 whitespace-normal break-words min-w-0">
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRow(setLumpsumExpenses, r.id, "name", e.target.value)}
                        className="w-full bg-transparent outline-none border-b border-transparent hover:border-foreground/20 focus:border-emerald-500 px-1 py-0.5 transition-colors whitespace-normal break-words"
                      />
                    </td>
                    <td className="py-2 pr-1 pl-2">
                      <div className="flex items-center rounded-xl border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500 w-24">
                        <span className="pl-2 text-foreground/50 text-xs">$</span>
                        <input
                          type="number"
                          value={r.amount}
                          step={1000}
                          min={0}
                          onChange={(e) => updateRow(setLumpsumExpenses, r.id, "amount", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent px-2 py-1.5 outline-none text-sm"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => removeRow(setLumpsumExpenses, r.id)}
                        className="text-foreground/30 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.04] font-medium">
                  <td className="py-2 px-2 text-xs text-foreground/50 col-span-2" colSpan={2}>Total</td>
                  <td className="py-2 px-2 font-mono text-sm text-red-400">
                    {fmtMoney(lumpsumExpenses.reduce((s, r) => s + r.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

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
