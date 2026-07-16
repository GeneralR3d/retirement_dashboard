"use client";

import { useMemo } from "react";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Stat, Th, Td } from "@/app/components/ui";
import { computeBtoBreakdown, type BtoBreakdown } from "@/lib/bto";
import { buildCpfProjection, type CpfYearRow } from "@/lib/tax";
import Image from "next/image";

function oaBalanceAtAge(rows: CpfYearRow[], age: number, fallback: number): number {
  if (rows.length === 0) return fallback;
  const exact = rows.find((r) => r.age === age);
  if (exact) return exact.oaBalance;
  const first = rows[0];
  if (age < first.age) return fallback;
  return rows[rows.length - 1].oaBalance;
}

type BtoData = { breakdown: BtoBreakdown; cpfRowsFull: CpfYearRow[] };

export default function BtoPage() {
  const { inputs } = useProfile();

  // 3-pass CPF projection from saved inputs (draft changes only commit on Recalculate).
  // Returns accurate BTO breakdown (with correct post-DP1 OA for DP2) and the full CPF
  // projection with all BTO deductions applied (used for the mortgage repayment table).
  const { breakdown, cpfRowsFull } = useMemo((): BtoData => {
    const cpfBase = {
      currentAge: inputs.currentAge,
      stopWorkingAge: inputs.stopWorkingAge,
      cpfWithdrawalAge: inputs.cpfWithdrawalAge,
      cpfRetirementAge: inputs.cpfRetirementAge,
      startingSalary: inputs.startingSalary,
      salaryGrowthRate: inputs.salaryGrowthRate,
      cpfOA: inputs.cpfOA,
      cpfSA: inputs.cpfSA,
      cpfMA: inputs.cpfMA,
      cpfRA: inputs.cpfRA,
      cpfLifeFrs: inputs.cpfLifeFrs,
      endAge: inputs.deathAge,
      salarySeries:
        inputs.salarySeries.length === Math.max(0, inputs.stopWorkingAge - inputs.currentAge)
          ? inputs.salarySeries
          : undefined,
    };

    if (inputs.btoFlatPrice <= 0) {
      return {
        breakdown: computeBtoBreakdown(inputs, 0, 0),
        cpfRowsFull: buildCpfProjection(cpfBase),
      };
    }

    // Pass 1: no BTO deductions → OA at DP1 age
    const pass1 = buildCpfProjection(cpfBase);
    const oa1 = oaBalanceAtAge(pass1, inputs.btoApplicationAge, inputs.cpfOA);

    // Pass 2: DP1 deduction only → corrected OA at DP2 age
    const bto1 = computeBtoBreakdown(inputs, oa1, 0);
    const dp1Deds = bto1.dp1.fromOA > 0
      ? [{ age: inputs.btoApplicationAge, amount: bto1.dp1.fromOA }]
      : [];
    const pass2 = buildCpfProjection({ ...cpfBase, oaDeductions: dp1Deds });
    const oa2 = oaBalanceAtAge(pass2, inputs.btoCollectionAge, inputs.cpfOA);

    // Full BTO breakdown with accurate OA values for both DPs
    const bto = computeBtoBreakdown(inputs, oa1, oa2);

    // Pass 3: all deductions (DP1, DP2, annual mortgage for every mortgage year)
    const allDeds: { age: number; amount: number }[] = [];
    if (bto.dp1.fromOA > 0) allDeds.push({ age: inputs.btoApplicationAge, amount: bto.dp1.fromOA });
    if (bto.dp2.fromOA > 0) allDeds.push({ age: inputs.btoCollectionAge, amount: bto.dp2.fromOA });
    if (bto.monthlyMortgage > 0) {
      const annualMortgage = bto.monthlyMortgage * 12;
      for (let age = inputs.btoCollectionAge; age <= bto.mortgageEndAge; age++) {
        allDeds.push({ age, amount: annualMortgage });
      }
    }

    return {
      breakdown: bto,
      cpfRowsFull: buildCpfProjection({ ...cpfBase, oaDeductions: allDeds }),
    };
  }, [inputs]);

  // Per-year mortgage repayment split: how much from CPF OA vs cash.
  // At btoCollectionAge, DP2 is deducted before mortgage, so the OA available
  // for mortgage = (oaBeforeAnyDeduction - dp2.fromOA). For subsequent years,
  // oaDeducted in cpfRowsFull is purely the mortgage deduction.
  const mortgageRows = useMemo(() => {
    if (breakdown.monthlyMortgage <= 0) return [];
    const annualMortgage = breakdown.monthlyMortgage * 12;
    return Array.from(
      { length: inputs.btoLoanTenureYears },
      (_, k) => {
        const age = inputs.btoCollectionAge + k;
        const cpfRow = cpfRowsFull.find((r) => r.age === age);
        let fromCPF: number;
        if (k === 0) {
          // At collection age DP2 is deducted first; mortgage gets what remains
          const oaAfterDp2 = Math.max(0, breakdown.dp2.oaAvailable - breakdown.dp2.fromOA);
          fromCPF = Math.min(annualMortgage, oaAfterDp2);
        } else {
          // All other mortgage years: oaDeducted is solely the mortgage payment
          fromCPF = cpfRow?.oaDeducted ?? 0;
        }
        return {
          age,
          annualMortgage,
          fromCPF,
          fromCash: annualMortgage - fromCPF,
          oaBalance: cpfRow?.oaBalance ?? 0,
        };
      },
    );
  }, [breakdown, cpfRowsFull, inputs.btoCollectionAge, inputs.btoLoanTenureYears]);

  const ratiosPct = {
    dp1: ((breakdown.dp1Amount / Math.max(1, breakdown.flatPrice)) * 100).toFixed(1),
    dp2: ((breakdown.dp2Amount / Math.max(1, breakdown.flatPrice)) * 100).toFixed(1),
  };

  const totalDpFromGrant = breakdown.dp1.fromGrant + breakdown.dp2.fromGrantLeftover;

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <Image src="/hdblogo.png" alt="HDB logo" width={120} height={40} className="shrink-0 object-contain" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">BTO Mortgage</h1>
        </div>
      </header>

      {/* Display cards — full width, vertical timeline */}
      <div className="mb-3">
        <h2 className="font-semibold">Timeline</h2>
        </div>
      <div className="relative pl-10 flex flex-col gap-7 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-foreground/20 [&>*]:relative [&>*]:before:content-[''] [&>*]:before:absolute [&>*]:before:-left-[1.85rem] [&>*]:before:top-6 [&>*]:before:w-2.5 [&>*]:before:h-2.5 [&>*]:before:rounded-full [&>*]:before:bg-emerald-500 [&>*]:before:ring-4 [&>*]:before:ring-background">
          <StatCard label="Total price of flat" value={fmtMoney(breakdown.flatPrice)} />

          <StatCard
            label="Total grant amount"
            value={fmtMoney(breakdown.totalGrant)}
            sub={
              breakdown.scheme === "deferred"
                ? "Deferred income — grant applies at Downpayment 2"
                : undefined
            }
            accent={breakdown.totalGrant > 0 ? "emerald" : undefined}
          />

          {/* Downpayment 1 */}
          <div className="glass-card p-5">
            <div className="text-xs uppercase tracking-wide text-foreground/85 dark:text-foreground/60">
              Downpayment 1
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {fmtMoney(breakdown.dp1.proposed)}
            </div>
            <div className="text-xs text-foreground/85 dark:text-foreground/60 mt-1">
              {ratiosPct.dp1}% of flat price · age {inputs.btoApplicationAge}
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 mt-4">
              <Stat label="From grant" value={fmtMoney(breakdown.dp1.fromGrant)} />
              <Stat
                label={`From CPF OA`}
                value={fmtMoney(breakdown.dp1.fromOA)}
              />
              <Stat label="From cash" value={fmtMoney(breakdown.dp1.fromCash)} />
            </div>
            <div className="text-[11px] text-foreground/75 dark:text-foreground/50 mt-2 font-mono">
              OA available @ age {inputs.btoApplicationAge}: {fmtMoney(breakdown.dp1.oaAvailable)}
            </div>
          </div>

          <StatCard
            label="Leftover grant amount"
            value={fmtMoney(breakdown.leftoverGrantAfterDp1)}
            sub={
              breakdown.scheme === "deferred"
                ? "Full grant carries forward (deferred scheme)"
                : "Grant remaining after Downpayment 1"
            }
          />

          {/* Downpayment 2 */}
          <div className="glass-card p-5">
            <div className="text-xs uppercase tracking-wide text-foreground/85 dark:text-foreground/60">
              Downpayment 2
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {fmtMoney(breakdown.dp2.actualPaid)}
            </div>
            <div className="text-xs text-foreground/85 dark:text-foreground/60 mt-1">
              {breakdown.dp2.actualPaid > breakdown.dp2.proposed
                ? `Grant exceeds ${ratiosPct.dp2}% scheme amount (${fmtMoney(breakdown.dp2.proposed)}) · age ${inputs.btoCollectionAge}`
                : `${ratiosPct.dp2}% of flat price · age ${inputs.btoCollectionAge}`}
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 mt-4">
              <Stat label="From grant (leftover)" value={fmtMoney(breakdown.dp2.fromGrantLeftover)} />
              <Stat label="From CPF OA" value={fmtMoney(breakdown.dp2.fromOA)} />
              <Stat label="From cash" value={fmtMoney(breakdown.dp2.fromCash)} />
            </div>
            <div className="text-[11px] text-foreground/75 dark:text-foreground/50 mt-2 font-mono">
              OA available @ age {inputs.btoCollectionAge}: {fmtMoney(breakdown.dp2.oaAvailable)}
            </div>
          </div>

          <StatCard
            label="Total downpayment (DP1 + DP2)"
            value={fmtMoney(breakdown.totalDownpayment)}
            sub={
              totalDpFromGrant > 0
                ? `Of which from grant: ${fmtMoney(totalDpFromGrant)}`
                : undefined
            }
          />

          <StatCard
            label="Loan amount"
            value={fmtMoney(breakdown.loanAmount)}
            sub={`LTV ${(breakdown.ltvRatio * 100).toFixed(1)}% · ${(breakdown.interestRate * 100).toFixed(2)}% p.a.`}
          />

          <StatCard
            label="Monthly mortgage"
            value={fmtMoney(Math.round(breakdown.monthlyMortgage))}
            sub={`Age ${breakdown.mortgageStartAge} → ${breakdown.mortgageEndAge} (${inputs.btoLoanTenureYears} yrs)`}
          />
      </div>

      {/* Mortgage repayment table */}
      {mortgageRows.length > 0 && (
        <section className="mt-10 glass-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Annual mortgage repayment</h2>
            <p className="text-foreground/85 dark:text-foreground/60 text-xs mt-0.5">
              Shows how much of each year&apos;s mortgage is covered by CPF OA and how much requires cash.
              When the OA balance hits zero, the full annual payment shifts to cash.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/85 dark:text-foreground/60 border-b border-foreground/10">
                  <Th>Age</Th>
                  <Th>Annual mortgage</Th>
                  <Th>From CPF OA</Th>
                  <Th>From cash</Th>
                  <Th>OA balance (after)</Th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {mortgageRows.map((r) => {
                  const cpfDepleted = r.fromCash > 0;
                  return (
                    <tr
                      key={r.age}
                      className={`border-b border-foreground/5 ${cpfDepleted ? "bg-rose-500/[0.07]" : "hover:bg-foreground/[0.04]"}`}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <span>{r.age}</span>
                          {cpfDepleted && r.fromCPF === 0 && (
                            <span className="text-[10px] font-sans font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                              OA depleted
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>{fmtMoney(r.annualMortgage)}</Td>
                      <Td className={r.fromCPF === 0 ? "text-foreground/60 dark:text-foreground/30" : "text-blue-700 dark:text-blue-400"}>
                        {r.fromCPF === 0 ? "—" : fmtMoney(r.fromCPF)}
                      </Td>
                      <Td className={cpfDepleted ? "text-rose-700 dark:text-rose-400 font-semibold" : "text-foreground/60 dark:text-foreground/30"}>
                        {cpfDepleted ? fmtMoney(r.fromCash) : "—"}
                      </Td>
                      <Td className={r.oaBalance <= 0 ? "text-foreground/60 dark:text-foreground/30" : "text-blue-700 dark:text-blue-400/70"}>
                        {r.oaBalance <= 0 ? "—" : fmtMoney(r.oaBalance)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.04] font-medium">
                  <td className="py-3 px-2 text-sm text-foreground/85 dark:text-foreground/70" colSpan={2}>
                    Total ({inputs.btoLoanTenureYears} yrs)
                  </td>
                  <td className="py-3 px-2 font-mono text-sm text-blue-700 dark:text-blue-400">
                    {fmtMoney(mortgageRows.reduce((s, r) => s + r.fromCPF, 0))}
                  </td>
                  <td className="py-3 px-2 font-mono text-sm text-rose-700 dark:text-rose-400">
                    {fmtMoney(mortgageRows.reduce((s, r) => s + r.fromCash, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
