"use client";

import { useState } from "react";
import type { ProfileInputs } from "@/lib/profile-context";
import { NumberField, Slider, InfoTooltip } from "@/app/components/ui";
import { fmtMoney } from "@/lib/format";
import {
  GRANT_CAPS,
  HDB_LOAN_RATE,
  maxTenureFor,
  totalGrantAmount,
} from "@/lib/bto";

type DownpaymentScheme = "normal" | "staggered" | "deferred";
type LoanType = "hdb" | "bank";
type ApplicantType = "single" | "couple";

export type BtoInputsProps = {
  draft: ProfileInputs;
  setDraft: (next: ProfileInputs) => void;
};

export function BtoInputsPanel({ draft, setDraft }: BtoInputsProps) {
  const [showGrants, setShowGrants] = useState(false);

  function update<K extends keyof ProfileInputs>(key: K, value: ProfileInputs[K]) {
    let next: ProfileInputs = { ...draft, [key]: value };
    if (key === "btoLoanType") {
      // clamp tenure to new max
      const max = maxTenureFor(value as LoanType);
      if (next.btoLoanTenureYears > max) {
        next = { ...next, btoLoanTenureYears: max };
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
          {(["single", "couple"] as ApplicantType[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => update("btoApplicantType", opt)}
              className={`flex-1 border px-3 py-2 text-sm capitalize transition-colors ${
                draft.btoApplicantType === opt
                  ? "border-foreground/40 bg-foreground/10 font-medium"
                  : "border-foreground/10 bg-foreground/[0.03] text-foreground/85 dark:text-foreground/70 hover:bg-foreground/[0.07]"
              }`}
            >
              {opt}
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
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Age of application"
          value={draft.btoApplicationAge}
          onChange={(v) => update("btoApplicationAge", v)}
          step={1}
        />
        <NumberField
          label="Age of collection"
          value={draft.btoCollectionAge}
          onChange={(v) => update("btoCollectionAge", v)}
          step={1}
        />
      </div>

      {/* Downpayment scheme */}
      <div>
        <span className="block text-sm text-foreground/80 mb-1">Downpayment scheme</span>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "normal", label: "Normal", sub: "10% / 15%" },
            { id: "staggered", label: "Staggered", sub: "5% / 20%" },
            { id: "deferred", label: "Deferred", sub: "2.5% / 22.5%" },
          ] as { id: DownpaymentScheme; label: string; sub: string }[]).map(({ id, label, sub }) => (
            <button
              key={id}
              type="button"
              onClick={() => update("btoDownpaymentScheme", id)}
              className={`border px-3 py-2 text-sm transition-colors ${
                draft.btoDownpaymentScheme === id
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

      {/* Grants accordion */}
      <div className="border border-foreground/20 bg-foreground/[0.03] overflow-hidden">
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
              label={`Enhanced Housing Grant (EHG) — up to ${fmtMoney(GRANT_CAPS.ehg)}`}
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
            {draft.btoDownpaymentScheme === "deferred" && (
              <p className="text-xs text-amber-700 dark:text-amber-400/80">
                Deferred income scheme: grants are not applied at downpayment 1; full amount carries to downpayment 2.
              </p>
            )}
          </div>
        )}
      </div>

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
              className={`flex-1 border px-3 py-2 text-sm transition-colors ${
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
    </div>
  );
}

