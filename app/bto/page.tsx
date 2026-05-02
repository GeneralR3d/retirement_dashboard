"use client";

import { useMemo, useRef, useState } from "react";
import { useProfile, type ProfileInputs } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Stat } from "@/app/components/ui";
import { BtoInputsPanel } from "@/app/components/bto-inputs";
import { computeBtoBreakdown } from "@/lib/bto";
import { buildCpfProjection } from "@/lib/tax";

function oaBalanceAtAge(rows: ReturnType<typeof buildCpfProjection>, age: number, fallback: number): number {
  if (rows.length === 0) return fallback;
  const exact = rows.find((r) => r.age === age);
  if (exact) return exact.oaBalance;
  // Before currentAge → use starting OA. After end → last row.
  const first = rows[0];
  if (age < first.age) return fallback;
  return rows[rows.length - 1].oaBalance;
}

export default function BtoPage() {
  const { inputs, setInputs } = useProfile();

  const [draft, setDraft] = useState<ProfileInputs>(inputs);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(inputs);

  function handleRecalculate() {
    setInputs(latestDraft.current);
  }

  // CPF projection comes from the *saved* inputs so the OA lookup reflects
  // committed assumptions; draft changes only commit on Recalculate.
  const cpfRows = useMemo(
    () =>
      buildCpfProjection({
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
      }),
    [inputs],
  );

  const breakdown = useMemo(() => {
    const oa1 = oaBalanceAtAge(cpfRows, inputs.btoApplicationAge, inputs.cpfOA);
    const oa2 = oaBalanceAtAge(cpfRows, inputs.btoCollectionAge, inputs.cpfOA);
    return computeBtoBreakdown(inputs, oa1, oa2);
  }, [cpfRows, inputs]);

  const ratiosPct = {
    dp1: ((breakdown.dp1Amount / Math.max(1, breakdown.flatPrice)) * 100).toFixed(1),
    dp2: ((breakdown.dp2Amount / Math.max(1, breakdown.flatPrice)) * 100).toFixed(1),
  };

  const totalDpFromGrant = breakdown.dp1.fromGrant + breakdown.dp2.fromGrantLeftover;

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">BTO Mortgage</h1>
          <p className="text-foreground/60 text-sm mt-1">
            Plan your BTO downpayments, grants, and mortgage. These inputs are shared with the Config page.
          </p>
          <p className="text-foreground/50 text-xs mt-2">
            Edit fields below — click Recalculate to commit. Display cards on the right reflect saved inputs.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && <span className="text-xs text-amber-400/80">Unsaved changes</span>}
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

      {/* Inputs — full width */}
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6 mb-10">
        <div className="mb-4">
          <h2 className="font-semibold">Inputs</h2>
          <p className="text-foreground/60 text-xs mt-0.5">
            Source of truth lives on the Config page; edits here update the same shared profile.
          </p>
        </div>
        <BtoInputsPanel draft={draft} setDraft={setDraft} />
      </div>

      {/* Display cards — full width, vertical timeline */}
      <div className="mb-3">
        <h2 className="font-semibold">Breakdown</h2>
        <p className="text-foreground/60 text-xs mt-0.5">
          Chronological view of payments, from application through to monthly mortgage.
        </p>
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
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
            <div className="text-xs uppercase tracking-wide text-foreground/60">
              Downpayment 1
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {fmtMoney(breakdown.dp1.proposed)}
            </div>
            <div className="text-xs text-foreground/60 mt-1">
              {ratiosPct.dp1}% of flat price · age {inputs.btoApplicationAge}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="From grant" value={fmtMoney(breakdown.dp1.fromGrant)} />
              <Stat
                label={`From CPF OA`}
                value={fmtMoney(breakdown.dp1.fromOA)}
              />
              <Stat label="From cash" value={fmtMoney(breakdown.dp1.fromCash)} />
            </div>
            <div className="text-[11px] text-foreground/50 mt-2 font-mono">
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
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
            <div className="text-xs uppercase tracking-wide text-foreground/60">
              Downpayment 2
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {fmtMoney(breakdown.dp2.actualPaid)}
            </div>
            <div className="text-xs text-foreground/60 mt-1">
              {breakdown.dp2.actualPaid > breakdown.dp2.proposed
                ? `Grant exceeds ${ratiosPct.dp2}% scheme amount (${fmtMoney(breakdown.dp2.proposed)}) · age ${inputs.btoCollectionAge}`
                : `${ratiosPct.dp2}% of flat price · age ${inputs.btoCollectionAge}`}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="From grant (leftover)" value={fmtMoney(breakdown.dp2.fromGrantLeftover)} />
              <Stat label="From CPF OA" value={fmtMoney(breakdown.dp2.fromOA)} />
              <Stat label="From cash" value={fmtMoney(breakdown.dp2.fromCash)} />
            </div>
            <div className="text-[11px] text-foreground/50 mt-2 font-mono">
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
    </main>
  );
}
