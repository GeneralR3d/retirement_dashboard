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
          <p className="text-foreground/85 dark:text-foreground/60 text-sm mt-1">
            Plan your BTO downpayments, grants, and mortgage.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1 shrink-0">
          {isDirty && <span className="text-xs text-amber-700 dark:text-amber-400/80">Unsaved changes</span>}
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
            <defs>
              {/* Night sky — deep navy, works as opaque backdrop in both light and dark modes */}
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#04090f" />
                <stop offset="60%" stopColor="#071524" />
                <stop offset="100%" stopColor="#091d2e" />
              </linearGradient>
              {/* Main facade — slightly lighter on top (ambient sky bounce) */}
              <linearGradient id="facadeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e2d3e" />
                <stop offset="100%" stopColor="#192538" />
              </linearGradient>
              {/* Lift-shaft — darker recessed panel */}
              <linearGradient id="liftGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0c1825" />
                <stop offset="100%" stopColor="#111e2d" />
              </linearGradient>
              {/* Void deck — open, darker interior */}
              <linearGradient id="voidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d1928" />
                <stop offset="100%" stopColor="#07111c" />
              </linearGradient>
              {/* Ground plane */}
              <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0a1622" />
                <stop offset="100%" stopColor="#050d16" />
              </linearGradient>
            </defs>

            {/* ── Sky ── */}
            <rect width="340" height="420" fill="url(#skyGrad)" />

            {/* Stars */}
            {([
              [22,14],[48,28],[12,62],[308,18],[318,52],[288,14],[38,88],
              [272,72],[322,88],[58,10],[160,8],[240,32],[100,40],
            ] as [number,number][]).map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r={i%3===0?1.1:0.7} fill="#fff"
                opacity={0.08 + (i % 4) * 0.06} />
            ))}

            {/* Moon with soft halo */}
            <circle cx="292" cy="36" r="28" fill="#c7d8f0" opacity="0.03" />
            <circle cx="292" cy="36" r="18" fill="#ddeeff" opacity="0.05" />
            <circle cx="295" cy="33" r="12" fill="#eef6ff" opacity="0.08" />

            {/* Distant low-rise blocks in bg for depth */}
            <rect x="0"   y="290" width="60"  height="65" fill="#0d1a28" opacity="0.6" />
            <rect x="10"  y="270" width="35"  height="85" fill="#0f1e2e" opacity="0.5" />
            <rect x="280" y="285" width="60"  height="70" fill="#0d1a28" opacity="0.6" />
            <rect x="295" y="265" width="35"  height="90" fill="#0f1e2e" opacity="0.5" />
            {/* Tiny lit windows on bg blocks */}
            {([
              [14,278],[22,278],[14,292],[22,292],
              [300,272],[308,272],[300,286],[308,286],
            ] as [number,number][]).map(([wx,wy],i) => (
              <rect key={i} x={wx} y={wy} width="5" height="4"
                fill="#fef08a" opacity={i%3===0?0.18:0.07} />
            ))}

            {/* ══════════════════════════════════════
                HDB BLOCK
                x=70 → x=270  (200 px wide)
                13 residential floors × 20 px = 260 px
                y=28 → y=288
                Void deck: y=288 → y=345 (57 px)
                Parapet: y=18 → y=28
            ══════════════════════════════════════ */}

            {/* Drop shadow */}
            <rect x="74" y="32" width="200" height="315" fill="#000" opacity="0.35" rx="1" />

            {/* ── Main facade ── */}
            <rect x="70" y="28" width="200" height="260" fill="url(#facadeGrad)" />

            {/* ── Lift shaft (left strip, x=70–94) ── */}
            <rect x="70" y="28" width="24" height="260" fill="url(#liftGrad)" />
            {/* Inset darker panel */}
            <rect x="73" y="28" width="18" height="260" fill="#09141f" opacity="0.55" />
            {/* Lift-shaft top cap */}
            <rect x="70" y="28" width="24" height="4" fill="#0a1520" />

            {/* ── Corridor strip (right, x=247–270) ── */}
            <rect x="247" y="28" width="23" height="260" fill="#13202f" />
            {/* Corridor outer edge — open-air grille hint */}
            <rect x="265" y="28" width="5" height="260" fill="#0c1825" />
            {([28,48,68,88,108,128,148,168,188,208,228,248,268] as number[]).map((sy,i) => (
              <rect key={i} x="265" y={sy} width="5" height="4" fill="#1e3a5f" opacity="0.35" />
            ))}

            {/* ── Roof parapet ── */}
            <rect x="64" y="18" width="212" height="13" fill="#18273a" rx="1" />
            {/* Parapet top accent stripe — signature HDB emerald band */}
            <rect x="64" y="15" width="212" height="5" fill="#10b981" opacity="0.55" rx="1" />
            {/* Parapet crenellations */}
            {([76,106,136,166,196,226,252] as number[]).map((px,i) => (
              <rect key={i} x={px} y="15" width="14" height="8" fill="#18273a" rx="0" />
            ))}
            {/* Glow line */}
            <rect x="64" y="15" width="212" height="1" fill="#34d399" opacity="0.8" />

            {/* ── Rooftop mechanical / water tank ── */}
            <rect x="178" y="4"  width="58" height="14" fill="#0e1c2c" rx="2" />
            <rect x="178" y="2"  width="58" height="5"  fill="#18273a" rx="1" />
            <rect x="188" y="4"  width="4"  height="7"  fill="#081220" />
            <rect x="222" y="4"  width="4"  height="7"  fill="#081220" />
            <rect x="189" y="5"  width="2"  height="4"  fill="#10b981" opacity="0.35" />
            {/* Antenna / lightning rod */}
            <rect x="96"  y="7"  width="3"  height="12" fill="#1e2d3e" />
            <rect x="89"  y="7"  width="17" height="2"  fill="#1e2d3e" />
            <rect x="105" y="7"  width="1"  height="6"  fill="#10b981" opacity="0.4" />

            {/* ── Floor slab lines (13 slabs, one per floor bottom) ── */}
            {Array.from({length: 13}, (_, i) => (
              <rect key={i} x="70" y={28 + (i+1)*20} width="200" height="2"
                fill="#09121d" opacity="0.95" />
            ))}

            {/* ── Accent colour bands (HDB signature horizontal stripes) ──
                Band A: floors 3-4 (y=88–128)
                Band B: floors 8-9 (y=188–228)
            ── */}
            {/* Band A */}
            <rect x="70" y="88" width="200" height="40" fill="#065f46" opacity="0.28" />
            <rect x="70" y="88"  width="200" height="2" fill="#10b981" opacity="0.5" />
            <rect x="70" y="128" width="200" height="2" fill="#10b981" opacity="0.5" />
            {/* Band B */}
            <rect x="70" y="188" width="200" height="40" fill="#065f46" opacity="0.22" />
            <rect x="70" y="188" width="200" height="2" fill="#10b981" opacity="0.4" />
            <rect x="70" y="228" width="200" height="2" fill="#10b981" opacity="0.4" />

            {/* ── Windows  (6 per floor × 13 floors)
                x starts: 100 122 144 166 188 210  (pitch=22, width=16)
                wy = 28 + floor*20 + 4
            ── */}
            {Array.from({length: 13}, (_, floor) => {
              const slabY = 28 + floor * 20;
              const wy = slabY + 4;
              return (
                <g key={`fl${floor}`}>
                  {([100,122,144,166,188,210] as number[]).map((wx, wi) => {
                    const lit = (floor * 3 + wi * 2) % 5 === 0 || (floor + wi) % 4 === 0;
                    return (
                      <g key={wi}>
                        {/* Recess shadow */}
                        <rect x={wx-1} y={wy-1} width="18" height="14" fill="#040c16" rx="1" />
                        {/* Glass pane */}
                        <rect x={wx} y={wy} width="16" height="12" fill="#0b1f38" rx="1" />
                        <rect x={wx} y={wy} width="16" height="12"
                          fill="#3b82f6" opacity={lit ? 0.16 : 0.05} rx="1" />
                        {/* Pane dividers */}
                        <line x1={wx+8} y1={wy}    x2={wx+8} y2={wy+12}
                          stroke="#3b82f6" strokeWidth="0.6" strokeOpacity="0.2" />
                        <line x1={wx}   y1={wy+6}  x2={wx+16} y2={wy+6}
                          stroke="#3b82f6" strokeWidth="0.6" strokeOpacity="0.2" />
                        {/* Interior warm light */}
                        {lit && (
                          <rect x={wx+1} y={wy+1} width="7" height="5"
                            fill="#fef08a" opacity="0.22" rx="0.5" />
                        )}
                      </g>
                    );
                  })}

                  {/* Lift door per floor */}
                  <rect x="76" y={wy} width="12" height="12" fill="#08131e" rx="1" />
                  <line x1="82" y1={wy} x2="82" y2={wy+12}
                    stroke="#1e3a5f" strokeWidth="0.8" strokeOpacity="0.55" />
                  {/* Lift button indicator */}
                  <circle cx="90" cy={wy+6} r="1.5" fill="#10b981"
                    opacity={floor % 4 === 1 ? 0.7 : 0.15} />
                </g>
              );
            })}

            {/* ── Void deck (y=288–345) ── */}
            <rect x="70" y="288" width="200" height="57" fill="url(#voidGrad)" />
            {/* Deck soffit */}
            <rect x="70" y="288" width="200" height="3" fill="#09121d" />

            {/* Pillars — 6 columns */}
            {([83,114,145,176,207,238] as number[]).map((px,i) => (
              <g key={i}>
                <rect x={px} y="288" width="10" height="57" fill="#0d1928" />
                {/* Pillar highlight edge */}
                <rect x={px} y="288" width="1.5" height="57" fill="#182535" />
              </g>
            ))}

            {/* Void deck floor */}
            <rect x="70" y="342" width="200" height="3" fill="#0c1825" />

            {/* Letter boxes (HDB void deck fixture) */}
            <rect x="90" y="304" width="42" height="28" fill="#0c1825" rx="1" opacity="0.9" />
            {([0,1,2,3,4,5,6,7] as number[]).map(i => (
              <rect key={i} x={93+(i%4)*9} y={307+Math.floor(i/4)*12}
                width="7" height="9" fill="#131e2e" rx="0.5" />
            ))}
            {/* Bench */}
            <rect x="158" y="334" width="44" height="4" fill="#111e2e" rx="1" />
            <rect x="162" y="338" width="3"  height="5" fill="#111e2e" />
            <rect x="197" y="338" width="3"  height="5" fill="#111e2e" />

            {/* Block number sign */}
            <rect x="128" y="296" width="84" height="20" fill="#0c1825" rx="1" opacity="0.92" />
            <rect x="130" y="298" width="80" height="16" fill="#10b981" rx="1" opacity="0.08" />
            <rect x="138" y="303" width="54" height="3" fill="#10b981" opacity="0.48" rx="1" />
            <rect x="146" y="308" width="36" height="2" fill="#10b981" opacity="0.28" rx="1" />

            {/* ── Ground plane ── */}
            <rect x="0" y="345" width="340" height="75" fill="url(#groundGrad)" />
            {/* Sidewalk slab */}
            <rect x="0" y="345" width="340" height="13" fill="#0b1a28" opacity="0.7" />
            {/* Ground accent line */}
            <rect x="0" y="343" width="340" height="3" fill="#10b981" opacity="0.13" />

            {/* Landscaping — trees flanking the block */}
            <rect x="23"  y="344" width="5"  height="14" fill="#041a0e" opacity="0.85" />
            <ellipse cx="25"  cy="338" rx="20" ry="12" fill="#064e3b" opacity="0.8" />
            <ellipse cx="18"  cy="333" rx="13" ry="9"  fill="#065f46" opacity="0.65" />

            <rect x="312" y="344" width="5"  height="14" fill="#041a0e" opacity="0.85" />
            <ellipse cx="315" cy="338" rx="20" ry="12" fill="#064e3b" opacity="0.8" />
            <ellipse cx="322" cy="333" rx="13" ry="9"  fill="#065f46" opacity="0.65" />

            {/* Smaller shrubs */}
            <ellipse cx="50"  cy="349" rx="11" ry="6" fill="#065f46" opacity="0.5" />
            <ellipse cx="290" cy="349" rx="11" ry="6" fill="#065f46" opacity="0.5" />

            {/* ── Building outline ── */}
            <rect x="70" y="28" width="200" height="317" fill="none"
              stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.12" />

            {/* Roof glow */}
            <rect x="64" y="15" width="212" height="1" fill="#34d399" opacity="0.65" />

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
            <div className="text-xs uppercase tracking-wide text-foreground/85 dark:text-foreground/60">
              Downpayment 1
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {fmtMoney(breakdown.dp1.proposed)}
            </div>
            <div className="text-xs text-foreground/85 dark:text-foreground/60 mt-1">
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
          <div className="border border-foreground/10 bg-foreground/[0.03] p-5">
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
            <div className="grid grid-cols-3 gap-2 mt-4">
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
        <section className="mt-10 border border-foreground/10 bg-foreground/[0.03] p-5">
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
