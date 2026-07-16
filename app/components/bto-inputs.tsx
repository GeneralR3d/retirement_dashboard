"use client";

import { useRef, useState } from "react";
import type { ProfileInputs } from "@/lib/profile-context";
import { NumberField, Slider, InfoTooltip } from "@/app/components/ui";
import { fmtMoney } from "@/lib/format";
import {
  GRANT_CAPS,
  HDB_LOAN_RATE,
  maxTenureFor,
  totalGrantAmount,
  ehgCapFor,
} from "@/lib/bto";

type DownpaymentScheme = "normal" | "staggered" | "deferred";
type LoanType = "hdb" | "bank";
type ApplicantType = "single" | "couple";

const BTO_AGE_MIN = 21;
const BTO_AGE_MAX = 55;
const BTO_MAX_GAP = 7;

function BtoAgeSlider({
  applicationAge,
  collectionAge,
  onChange,
}: {
  applicationAge: number;
  collectionAge: number;
  onChange: (app: number, col: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeHandle = useRef<"application" | "collection" | null>(null);
  const latestValues = useRef({ applicationAge, collectionAge });
  latestValues.current = { applicationAge, collectionAge };

  const pct = (v: number) =>
    ((v - BTO_AGE_MIN) / (BTO_AGE_MAX - BTO_AGE_MIN)) * 100;

  function ageFromClientX(clientX: number): number {
    if (!trackRef.current) return BTO_AGE_MIN;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (BTO_AGE_MAX - BTO_AGE_MIN) + BTO_AGE_MIN);
  }

  function onPointerDown(handle: "application" | "collection") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      activeHandle.current = handle;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activeHandle.current) return;
    const age = ageFromClientX(e.clientX);
    const { applicationAge: appAge, collectionAge: colAge } = latestValues.current;
    if (activeHandle.current === "application") {
      const newApp = Math.max(BTO_AGE_MIN, Math.min(age, colAge - 1));
      const newCol = colAge - newApp > BTO_MAX_GAP ? newApp + BTO_MAX_GAP : colAge;
      onChange(newApp, newCol);
    } else {
      // dragging collection shifts the entire segment (gap stays fixed)
      const gap = colAge - appAge;
      const newCol = Math.max(appAge + 1, Math.min(age, BTO_AGE_MAX));
      const newApp = Math.max(BTO_AGE_MIN, Math.min(newCol - gap, BTO_AGE_MAX - gap));
      onChange(newApp, newApp + gap);
    }
  }

  function onPointerUp() {
    activeHandle.current = null;
  }

  const pApp = pct(applicationAge);
  const pCol = pct(collectionAge);
  const waitYears = collectionAge - applicationAge;

  const handles = [
    { left: pApp, handle: "application" as const, label: "Application", age: applicationAge },
    { left: pCol, handle: "collection" as const, label: "Collection", age: collectionAge },
  ];

  return (
    <div className="py-2 select-none">
      <p className="text-sm text-foreground/80 mb-1">BTO ages</p>

      {/* Age numbers above handles */}
      <div className="relative h-5 mb-3">
        {handles.map(({ left, handle, age }) => (
          <span
            key={handle}
            className="absolute -translate-x-1/2 text-xs font-semibold font-mono text-foreground"
            style={{ left: `${left}%` }}
          >
            {age}
          </span>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-5"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Dotted base */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, currentColor 0, currentColor 4px, transparent 4px, transparent 10px)",
            opacity: 0.15,
          }}
        />

        {/* Waiting segment: application → collection */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[6px] bg-amber-400 pointer-events-none"
          style={{ left: `${pApp}%`, width: `${pCol - pApp}%` }}
        />

        {/* Handles */}
        {handles.map(({ left, handle }) => (
          <div
            key={handle}
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2
              w-[18px] h-[18px] rounded-full bg-amber-400 border-2 border-background
              shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
            style={{ left: `${left}%` }}
            onPointerDown={onPointerDown(handle)}
          />
        ))}
      </div>

      {/* Labels below handles */}
      <div className="relative h-5 mt-3">
        {handles.map(({ left, handle, label }) => (
          <span
            key={handle}
            className="absolute -translate-x-1/2 text-[10px] text-foreground/75 dark:text-foreground/50 whitespace-nowrap"
            style={{ left: `${left}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Wait duration + disclaimer */}
      <div className="mt-3 flex items-start gap-2 text-xs text-foreground/60">
        <span className="shrink-0 font-mono font-semibold text-amber-600 dark:text-amber-400">
          {waitYears} yr{waitYears !== 1 ? "s" : ""} wait
        </span>
        <span>· Most BTO flats are ready in ~4 years. Maximum gap is {BTO_MAX_GAP} years.</span>
      </div>
    </div>
  );
}

export type BtoInputsProps = {
  draft: ProfileInputs;
  setDraft: (next: ProfileInputs) => void;
};

export function BtoInputsPanel({ draft, setDraft }: BtoInputsProps) {
  const [showGrants, setShowGrants] = useState(false);

  function update<K extends keyof ProfileInputs>(key: K, value: ProfileInputs[K]) {
    let next: ProfileInputs = { ...draft, [key]: value };
    if (key === "btoLoanType") {
      const max = maxTenureFor(value as LoanType);
      if (next.btoLoanTenureYears > max) {
        next = { ...next, btoLoanTenureYears: max };
      }
    }
    if (key === "btoApplicantType" && value === "single") {
      if (next.btoDownpaymentScheme !== "normal") {
        next = { ...next, btoDownpaymentScheme: "normal" };
      }
      if (next.btoGrantEhg > GRANT_CAPS.ehgSingle) {
        next = { ...next, btoGrantEhg: GRANT_CAPS.ehgSingle };
      }
    }
    setDraft(next);
  }

  const tenureMax = maxTenureFor(draft.btoLoanType);
  const grantsTotal = totalGrantAmount({
    ...draft,
    // ignore the deferred zeroing for the collapsed display — show raw sum
    btoDownpaymentScheme: "normal",
  });

  return (
    <div className="space-y-5">
      {/* Applicant type */}
      <div>
        <span className="block text-sm text-foreground/80 mb-1">Applying as</span>
        <div className="flex gap-2">
          {(["single", "couple"] as ApplicantType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update("btoApplicantType", type)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                draft.btoApplicantType === type
                  ? "border-foreground/40 bg-foreground/10 font-medium"
                  : "border-foreground/10 bg-foreground/[0.03] text-foreground/85 dark:text-foreground/70 hover:bg-foreground/[0.07]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Flat price */}
      <NumberField
        label="Price of BTO flat"
        value={draft.btoFlatPrice}
        onChange={(v) => update("btoFlatPrice", v)}
        prefix="$"
        step={10000}
      />

      {/* Ages */}
      <BtoAgeSlider
        applicationAge={draft.btoApplicationAge}
        collectionAge={draft.btoCollectionAge}
        onChange={(app, col) => setDraft({ ...draft, btoApplicationAge: app, btoCollectionAge: col })}
      />

      {/* Loan type */}
      <div>
        <span className="block text-sm text-foreground/80 mb-1">Loan type</span>
        <div className="flex gap-2">
          {([
            { id: "hdb", label: "HDB loan", sub: `${(HDB_LOAN_RATE * 100).toFixed(1)}% p.a.` },
            { id: "bank", label: "Bank loan", sub: "custom rate" },
          ] as { id: LoanType; label: string; sub: string }[]).map(({ id, label, sub }) => (
            <button
              key={id}
              type="button"
              onClick={() => update("btoLoanType", id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                draft.btoLoanType === id
                  ? "border-foreground/40 bg-foreground/10 font-medium"
                  : "border-foreground/10 bg-foreground/[0.03] text-foreground/85 dark:text-foreground/70 hover:bg-foreground/[0.07]"
              }`}
            >
              <div>{label}</div>
              <div className="text-xs mt-0.5 font-mono text-foreground/85 dark:text-foreground/60">{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bank interest rate (only when bank) */}
      {draft.btoLoanType === "bank" && (
        <Slider
          label="Bank interest rate"
          value={draft.btoBankInterestRate}
          min={0}
          max={0.08}
          step={0.0005}
          suffix="%"
          format={(v) => (v * 100).toFixed(2)}
          onChange={(v) => update("btoBankInterestRate", v)}
        />
      )}

      {/* Tenure */}
      <Slider
        label="Loan tenure"
        value={Math.min(draft.btoLoanTenureYears, tenureMax)}
        min={1}
        max={tenureMax}
        step={1}
        suffix=" yrs"
        onChange={(v) => update("btoLoanTenureYears", v)}
      />

      {/* Downpayment scheme */}
      <div>
        <span className="flex items-center gap-1 text-sm text-foreground/80 mb-1">
          Downpayment scheme
          <InfoTooltip>
            Under the <strong>Deferred Income Assessment (DIA) Scheme</strong>, HDB assesses your income only at{" "}
            <strong>key collection</strong>, not at application. Your maximum loan and housing grants
            are therefore determined by your salary at collection age — usually higher than at
            application — so they may improve by the time you collect your keys.
          </InfoTooltip>
        </span>
        {draft.btoLoanType === "bank" && (() => {
          const info = {
            normal:    "DP1: 5% cash + 15% CPF OA / cash at booking. DP2: 5% CPF OA / cash at collection.",
            staggered: "DP1: 5% cash + 5% CPF OA / cash at booking. DP2: 15% CPF OA / cash at collection.",
            deferred:  "DP1: 2.5% cash at booking. DP2: 2.5% cash + 20% CPF OA / cash at collection.",
          }[draft.btoDownpaymentScheme];
          return (
            <p className="text-xs text-foreground/50 mb-2">
              Assumes 75% Loan-To-Value (LTV). {info}
            </p>
          );
        })()}
        <div className="grid grid-cols-3 gap-2">
          {(draft.btoLoanType === "hdb"
            ? [
                { id: "normal" as DownpaymentScheme, label: "Normal", sub: "10% / 15%" },
                { id: "staggered" as DownpaymentScheme, label: "Staggered", sub: "5% / 20%" },
                { id: "deferred" as DownpaymentScheme, label: "Deferred", sub: "2.5% / 22.5%" },
              ]
            : [
                { id: "normal" as DownpaymentScheme, label: "Normal", sub: "20% / 5%" },
                { id: "staggered" as DownpaymentScheme, label: "Staggered", sub: "10% / 15%" },
                { id: "deferred" as DownpaymentScheme, label: "Deferred", sub: "2.5% / 22.5%" },
              ]
          ).map(({ id, label, sub }) => {
            const disabledBySingle = draft.btoApplicantType === "single" && id !== "normal";
            return (
              <button
                key={id}
                type="button"
                disabled={disabledBySingle}
                onClick={() => !disabledBySingle && update("btoDownpaymentScheme", id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  disabledBySingle
                    ? "border-foreground/10 bg-foreground/[0.03] text-foreground/30 dark:text-foreground/20 cursor-not-allowed"
                    : draft.btoDownpaymentScheme === id
                    ? "border-foreground/40 bg-foreground/10 font-medium"
                    : "border-foreground/10 bg-foreground/[0.03] text-foreground/85 dark:text-foreground/70 hover:bg-foreground/[0.07]"
                }`}
              >
                <div>{label}</div>
                <div className={`text-xs mt-0.5 font-mono ${disabledBySingle ? "text-foreground/25 dark:text-foreground/15" : "text-foreground/85 dark:text-foreground/60"}`}>{sub}</div>
                {disabledBySingle && <div className="text-[10px] mt-0.5 text-foreground/30">unavailable</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grants accordion */}
      <div className="rounded-2xl border border-foreground/20 bg-foreground/[0.03] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGrants((v) => !v)}
          className="w-full text-left cursor-pointer px-4 pt-3 pb-2"
        >
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-foreground/80">
              Housing grants
              <span onClick={(e) => e.stopPropagation()}>
                <InfoTooltip>
                  <p className="font-semibold text-foreground mb-2">Housing Grant Guide</p>

                  <p className="font-medium text-foreground/90 mb-0.5">CPF Housing Grant (Family)</p>
                  <p className="mb-2 text-foreground/85 dark:text-foreground/70">Up to $80,000 for first-timer couples/families buying direct from HDB. Amount varies by flat type and income.</p>

                  <p className="font-medium text-foreground/90 mb-0.5">Enhanced Housing Grant (EHG)</p>
                  <p className="mb-2 text-foreground/85 dark:text-foreground/70">Up to $120,000 based on average monthly household income. Eligible if income ≤ $9,000/month. Amount decreases in $5,000 steps per $500 income band.</p>

                  <p className="font-medium text-foreground/90 mb-0.5">Proximity Housing Grant (PHG)</p>
                  <p className="mb-2 text-foreground/85 dark:text-foreground/70">$30,000 to live with parents; $20,000 to live near parents (within 4 km).</p>

                  <a
                    href="https://www.hdb.gov.sg/-/media/buying-a-flat/flat-grant-and-loan-eligibility/couples-and-families/enhanced-cpf-housing-grant/EHG-amount-Couples-and-Families-Aug-2024.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 dark:text-sky-400 underline hover:text-sky-800 dark:hover:text-sky-300"
                  >
                    EHG table source (HDB PDF) ↗
                  </a>
                </InfoTooltip>
              </span>
              <svg
                className={`w-4 h-4 text-foreground/85 dark:text-foreground/60 transition-transform duration-200 ${showGrants ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <span className="font-mono text-foreground font-semibold">
              {fmtMoney(grantsTotal)}
            </span>
          </div>
        </button>
        {showGrants && (
          <div className="border-t border-foreground/10 px-4 pt-3 pb-4 space-y-3">
            <NumberField
              label={`CPF Housing Grant (Family) — up to ${fmtMoney(GRANT_CAPS.family)}`}
              value={draft.btoGrantFamily}
              onChange={(v) => update("btoGrantFamily", v)}
              prefix="$"
              step={1000}
            />
            <NumberField
              label={`Enhanced Housing Grant (EHG) — up to ${fmtMoney(ehgCapFor(draft))}`}
              value={draft.btoGrantEhg}
              onChange={(v) => update("btoGrantEhg", v)}
              prefix="$"
              step={1000}
            />
            <NumberField
              label={`Proximity Housing Grant (PHG) — up to ${fmtMoney(GRANT_CAPS.phg)}`}
              value={draft.btoGrantPhg}
              onChange={(v) => update("btoGrantPhg", v)}
              prefix="$"
              step={1000}
            />
            {draft.btoLoanType === "hdb" && draft.btoDownpaymentScheme === "deferred" && (
              <p className="text-xs text-amber-700 dark:text-amber-400/80">
                Deferred income scheme: grants are not applied at downpayment 1; full amount carries to downpayment 2.
              </p>
            )}
            {draft.btoLoanType === "bank" && (
              <p className="text-xs text-amber-700 dark:text-amber-400/80">
                {draft.btoDownpaymentScheme === "deferred"
                  ? "Bank loan deferred: no grants at booking (full DP1 is cash); grants applied to the 20% flexible portion at collection."
                  : "Bank loan: grants applied to the flexible portion at booking first; any remainder carries to collection."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

