"use client";

import { useMemo, useRef, useState } from "react";
import { useProfile, type ProfileInputs } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Stat, Th, Td } from "@/app/components/ui";
import { BtoInputsPanel } from "@/app/components/bto-inputs";
import { computeBtoBreakdown, type BtoBreakdown } from "@/lib/bto";
import { buildCpfProjection, type CpfYearRow } from "@/lib/tax";

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
  const { inputs, setInputs } = useProfile();

  const [draft, setDraft] = useState<ProfileInputs>(inputs);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(inputs);

  function handleRecalculate() {
    setInputs(latestDraft.current);
  }

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
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">BTO Mortgage</h1>
          <p className="text-foreground/60 text-sm mt-1">
            Plan your BTO downpayments, grants, and mortgage.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && <span className="text-xs text-amber-400/80">Unsaved changes</span>}
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

      {/* Inputs — split layout: house SVG left, config panel right */}
      <div className="border border-foreground/10 bg-foreground/[0.03] mb-10 overflow-hidden flex min-h-[420px]">
        {/* Left: house illustration */}
        <div className="hidden md:flex flex-1 items-center justify-center bg-gradient-to-br from-emerald-950/40 via-foreground/[0.02] to-blue-950/30 relative overflow-hidden">
          <svg
            viewBox="0 0 340 420"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full absolute inset-0"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Sky gradient */}
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.18" />
              </linearGradient>
              <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#065f46" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Background fill */}
            <rect width="340" height="420" fill="url(#skyGrad)" />

            {/* Ground line */}
            <rect x="0" y="340" width="340" height="80" fill="#0f172a" opacity="0.4" rx="0" />

            {/* Ground grass accent */}
            <rect x="0" y="338" width="340" height="4" fill="#10b981" opacity="0.25" rx="2" />

            {/* HDB-style block — main tower */}
            <rect x="80" y="130" width="180" height="210" fill="url(#wallGrad)" rx="4" />

            {/* Roof / top accent bar */}
            <rect x="72" y="122" width="196" height="14" fill="url(#roofGrad)" rx="3" />

            {/* Roof triangle peak */}
            <polygon points="170,72 72,122 268,122" fill="url(#roofGrad)" opacity="0.9" />

            {/* Roof ridge line */}
            <line x1="170" y1="72" x2="170" y2="122" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.5" />

            {/* Chimney */}
            <rect x="200" y="58" width="14" height="28" fill="#1e293b" rx="2" />
            <rect x="197" y="54" width="20" height="6" fill="#047857" rx="1" />

            {/* Floor separators */}
            {[178, 226, 274].map((y, i) => (
              <rect key={i} x="80" y={y} width="180" height="2" fill="#ffffff" opacity="0.05" />
            ))}

            {/* Windows — row 1 */}
            {[104, 148, 192, 224].map((x, i) => (
              <g key={`w1-${i}`}>
                <rect x={x} y="145" width="20" height="22" fill="#1e3a5f" rx="2" opacity="0.9" />
                <rect x={x} y="145" width="20" height="22" fill="#3b82f6" rx="2" opacity="0.12" />
                <line x1={x + 10} y1="145" x2={x + 10} y2="167" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1={x} y1="156" x2={x + 20} y2="156" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                {/* window glow */}
                <rect x={x + 1} y="146" width="8" height="10" fill="#fef08a" rx="1" opacity={i === 1 || i === 3 ? "0.25" : "0.08"} />
              </g>
            ))}

            {/* Windows — row 2 */}
            {[104, 148, 192, 224].map((x, i) => (
              <g key={`w2-${i}`}>
                <rect x={x} y="193" width="20" height="22" fill="#1e3a5f" rx="2" opacity="0.9" />
                <rect x={x} y="193" width="20" height="22" fill="#3b82f6" rx="2" opacity="0.12" />
                <line x1={x + 10} y1="193" x2={x + 10} y2="215" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1={x} y1="204" x2={x + 20} y2="204" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                <rect x={x + 1} y="194" width="8" height="10" fill="#fef08a" rx="1" opacity={i === 0 || i === 2 ? "0.25" : "0.08"} />
              </g>
            ))}

            {/* Windows — row 3 */}
            {[104, 148, 192, 224].map((x, i) => (
              <g key={`w3-${i}`}>
                <rect x={x} y="241" width="20" height="22" fill="#1e3a5f" rx="2" opacity="0.9" />
                <rect x={x} y="241" width="20" height="22" fill="#3b82f6" rx="2" opacity="0.12" />
                <line x1={x + 10} y1="241" x2={x + 10} y2="263" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                <line x1={x} y1="252" x2={x + 20} y2="252" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.3" />
                <rect x={x + 1} y="242" width="8" height="10" fill="#fef08a" rx="1" opacity={i === 1 || i === 3 ? "0.2" : "0.06"} />
              </g>
            ))}

            {/* Door */}
            <rect x="152" y="292" width="36" height="48" fill="#0f172a" rx="3" />
            <rect x="152" y="292" width="36" height="48" fill="#10b981" rx="3" opacity="0.12" />
            <circle cx="182" cy="316" r="2.5" fill="#10b981" opacity="0.6" />
            {/* Door arch */}
            <path d="M152 292 Q170 278 188 292" fill="#10b981" opacity="0.15" />

            {/* Front steps */}
            <rect x="144" y="338" width="52" height="6" fill="#1e293b" rx="1" opacity="0.7" />
            <rect x="148" y="332" width="44" height="7" fill="#1e293b" rx="1" opacity="0.5" />

            {/* Side shrubs */}
            <ellipse cx="95" cy="336" rx="18" ry="10" fill="#065f46" opacity="0.6" />
            <ellipse cx="108" cy="330" rx="14" ry="9" fill="#047857" opacity="0.5" />
            <ellipse cx="245" cy="336" rx="18" ry="10" fill="#065f46" opacity="0.6" />
            <ellipse cx="232" cy="330" rx="14" ry="9" fill="#047857" opacity="0.5" />

            {/* Stars / decorative dots */}
            {[
              [30, 30], [50, 60], [20, 100], [300, 40], [310, 80], [280, 25], [60, 15],
            ].map(([cx, cy], i) => (
              <circle key={`star-${i}`} cx={cx} cy={cy} r="1" fill="#ffffff" opacity="0.2" />
            ))}

            {/* Moon */}
            <circle cx="290" cy="50" r="16" fill="#1e293b" opacity="0" />
            <circle cx="295" cy="44" r="12" fill="#fef9c3" opacity="0.08" />

            {/* Accent glow under roof */}
            <rect x="72" y="132" width="196" height="2" fill="url(#accentGrad)" opacity="0.5" rx="1" />

          </svg>
        </div>

        {/* Right: config panel (half width) */}
        <div className="w-full md:w-1/2 shrink-0 p-6 border-l border-foreground/10">
          <div className="mb-4">
            <h2 className="font-semibold">Inputs</h2>
          </div>
          <BtoInputsPanel draft={draft} setDraft={setDraft} />
        </div>
      </div>

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
          <div className="border border-foreground/10 bg-foreground/[0.03] p-5">
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
          <div className="border border-foreground/10 bg-foreground/[0.03] p-5">
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

      {/* Mortgage repayment table */}
      {mortgageRows.length > 0 && (
        <section className="mt-10 border border-foreground/10 bg-foreground/[0.03] p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Annual mortgage repayment</h2>
            <p className="text-foreground/60 text-xs mt-0.5">
              Shows how much of each year&apos;s mortgage is covered by CPF OA and how much requires cash.
              When the OA balance hits zero, the full annual payment shifts to cash.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/60 border-b border-foreground/10">
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
                            <span className="text-[10px] font-sans font-semibold text-rose-400 whitespace-nowrap">
                              OA depleted
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>{fmtMoney(r.annualMortgage)}</Td>
                      <Td className={r.fromCPF === 0 ? "text-foreground/30" : "text-blue-400"}>
                        {r.fromCPF === 0 ? "—" : fmtMoney(r.fromCPF)}
                      </Td>
                      <Td className={cpfDepleted ? "text-rose-400 font-semibold" : "text-foreground/30"}>
                        {cpfDepleted ? fmtMoney(r.fromCash) : "—"}
                      </Td>
                      <Td className={r.oaBalance <= 0 ? "text-foreground/30" : "text-blue-400/70"}>
                        {r.oaBalance <= 0 ? "—" : fmtMoney(r.oaBalance)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.04] font-medium">
                  <td className="py-3 px-2 text-sm text-foreground/70" colSpan={2}>
                    Total ({inputs.btoLoanTenureYears} yrs)
                  </td>
                  <td className="py-3 px-2 font-mono text-sm text-blue-400">
                    {fmtMoney(mortgageRows.reduce((s, r) => s + r.fromCPF, 0))}
                  </td>
                  <td className="py-3 px-2 font-mono text-sm text-rose-400">
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
