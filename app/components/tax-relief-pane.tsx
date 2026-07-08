"use client";

import { useState, useEffect, useRef } from "react";
import { calculateTax, getTaxBreakdown, TAX_RELIEF_CAP } from "@/lib/tax";
import { fmtMoney } from "@/lib/format";
import { InfoTooltip } from "@/app/components/ui";

const DONATION_MULTIPLIER = 2.5;

type ReliefDef = {
  id: string;
  name: string;
  group: "main" | "other";
  lapsed?: string;
};

const RELIEF_DEFS: ReliefDef[] = [
  { id: "earned_income",     name: "Earned Income Relief",                                   group: "main" },
  { id: "spouse",            name: "Spouse / Spouse Relief (Disability)",                    group: "main" },
  { id: "fdw_levy",          name: "Foreign Domestic Worker Levy Relief",                    group: "main", lapsed: "YA 2025" },
  { id: "cpf_employee",      name: "CPF Relief for Employees",                               group: "main" },
  { id: "cpf_self_employed", name: "CPF Relief for Self-Employed",                           group: "main" },
  { id: "cpf_platform",      name: "CPF Relief as a Platform Worker",                        group: "main" },
  { id: "nsman_self",        name: "NSman (Self) Relief",                                    group: "main" },
  { id: "nsman_wife",        name: "NSman (Wife) Relief",                                    group: "main" },
  { id: "nsman_parent",      name: "NSman (Parent) Relief",                                  group: "main" },
  { id: "parent",            name: "Parent Relief / Parent Relief (Disability)",             group: "main" },
  { id: "grandparent",       name: "Grandparent Caregiver Relief",                           group: "main" },
  { id: "sibling",           name: "Sibling Relief (Disability)",                            group: "main" },
  { id: "wmcr",              name: "Working Mother's Child Relief",                          group: "main" },
  { id: "child",             name: "Qualifying Child Relief / Child Relief (Disability)",    group: "main" },
  { id: "life_insurance",    name: "Life Insurance Relief",                                  group: "other" },
  { id: "course_fees",       name: "Course Fees Relief",                                     group: "other", lapsed: "YA 2026" },
  { id: "srs_relief",        name: "SRS Relief",                                             group: "other" },
  { id: "cpf_cashtopup",     name: "CPF Cash Top-up Relief",                                 group: "other" },
  { id: "cpf_medisave",      name: "CPF Relief (Compulsory & Voluntary Medisave)",           group: "other" },
];

type Props = {
  open: boolean;
  rowIndex: number | null;
  age: number;
  takeHome: number;
  srsTopUp: number;
  initialReliefs: Record<string, number>;
  onClose: () => void;
  onSave: (reliefs: Record<string, number>) => void;
};

export function TaxReliefPane({ open, rowIndex, age, takeHome, srsTopUp, initialReliefs, onClose, onSave }: Props) {
  const [reliefs, setReliefs] = useState<Record<string, number>>(initialReliefs);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Object.keys(initialReliefs).filter(k => k !== "donation_amount" && initialReliefs[k] > 0))
  );

  const lastRowIndex = useRef<number | null>(null);
  useEffect(() => {
    if (rowIndex !== null && rowIndex !== lastRowIndex.current) {
      lastRowIndex.current = rowIndex;
      setReliefs(initialReliefs);
      setSelected(new Set(Object.keys(initialReliefs).filter(k => k !== "donation_amount" && initialReliefs[k] > 0)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const donationAmount = reliefs["donation_amount"] ?? 0;
  const donationDeduction = donationAmount * DONATION_MULTIPLIER;

  const rawTotal = RELIEF_DEFS
    .filter(d => selected.has(d.id))
    .reduce((s, d) => s + (reliefs[d.id] || 0), 0);
  const totalRelief = Math.min(TAX_RELIEF_CAP, rawTotal);
  const isCapped = rawTotal > TAX_RELIEF_CAP;

  const chargeableIncome = Math.max(0, takeHome - srsTopUp - totalRelief - donationDeduction);
  const taxAmount = calculateTax(chargeableIncome);
  const taxNoReliefs = calculateTax(Math.max(0, takeHome - srsTopUp));
  const reliefSaving = taxNoReliefs - taxAmount;
  const effectiveRate = takeHome > 0 ? (taxAmount / takeHome) * 100 : 0;
  const bd = getTaxBreakdown(chargeableIncome);

  function toggleRelief(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSave() {
    const out: Record<string, number> = {};
    for (const id of selected) {
      const v = reliefs[id] ?? 0;
      if (v > 0) out[id] = v;
    }
    if (donationAmount > 0) out["donation_amount"] = donationAmount;
    onSave(out);
  }

  return (
    <>
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className={`fixed top-0 right-0 h-full z-50 flex flex-col rounded-l-3xl bg-background/85 backdrop-blur-2xl border-l border-white/50 dark:border-white/10 shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: "min(620px, 90vw)" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-foreground/10">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Tax Calculation</h2>
            <p className="text-xs text-foreground/55 mt-0.5">Age {age} · select reliefs and enter amounts</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] transition-colors text-base"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Income breakdown */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-foreground/45 mb-3 font-medium">Income</div>
            <div className="space-y-2 text-sm font-mono">
              <Row label="Take-home salary" value={fmtMoney(takeHome)} />
              {srsTopUp > 0 && <Row label="SRS deduction" value={`−${fmtMoney(srsTopUp)}`} valueClass="text-emerald-600 dark:text-emerald-400" />}
              {totalRelief > 0 && <Row label="Tax reliefs" value={`−${fmtMoney(totalRelief)}`} valueClass="text-emerald-600 dark:text-emerald-400" />}
              {donationDeduction > 0 && <Row label="Donation deduction" value={`−${fmtMoney(donationDeduction)}`} valueClass="text-violet-600 dark:text-violet-400" />}
              <div className="border-t border-foreground/10 pt-2">
                <Row label="Chargeable income" value={fmtMoney(chargeableIncome)} bold />
              </div>
            </div>
          </section>

          {/* Tax payable */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-foreground/45 mb-3 font-medium">Tax Payable</div>
            <div className="space-y-2 text-sm font-mono">
              {bd.rate > 0 ? (
                <>
                  <Row label={`${(bd.rate * 100).toFixed(1)}% on ${fmtMoney(bd.bracketFrom)}${bd.bracketTo !== Infinity ? ` – ${fmtMoney(bd.bracketTo)}` : "+"}`} value="" />
                  <Row label="Base tax" value={`$${bd.baseTax.toLocaleString("en-SG")}`} />
                  <Row label="Marginal tax" value={fmtMoney(Math.round(bd.marginalTax))} />
                </>
              ) : (
                <div className="text-sm text-foreground/55">No tax — chargeable income ≤ $20,000</div>
              )}
              <div className="border-t border-foreground/10 pt-2 flex justify-between items-baseline">
                <span className="text-base font-semibold font-sans text-foreground/85">Tax payable</span>
                <span className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 tabular-nums">{fmtMoney(taxAmount)}</span>
              </div>
              <div className="space-y-1 -mt-1">
                <Row label="Effective rate" value={`${effectiveRate.toFixed(2)}%`} />
                {reliefSaving > 0 && (
                  <Row label="Tax savings" value={`+${fmtMoney(reliefSaving)}`} valueClass="text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </div>
          </section>

          {/* Main relief grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] uppercase tracking-widest text-foreground/45 font-medium">Tax Reliefs</div>
                <InfoTooltip>
                  Eligibility conditions and amounts change each year. Always verify with the most up-to-date information from IRAS.{" "}
                  <a
                    href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 underline hover:text-emerald-800 dark:hover:text-emerald-300"
                  >
                    View on IRAS
                  </a>
                </InfoTooltip>
              </div>
              <div className={`text-xs font-mono ${isCapped ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-foreground/45"}`}>
                {isCapped ? `⚠ Capped at ${fmtMoney(TAX_RELIEF_CAP)}` : `${fmtMoney(rawTotal)} / ${fmtMoney(TAX_RELIEF_CAP)}`}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {RELIEF_DEFS.filter(d => d.group === "main").map(def => (
                <ReliefCard
                  key={def.id}
                  def={def}
                  selected={selected.has(def.id)}
                  amount={reliefs[def.id] ?? 0}
                  onToggle={() => toggleRelief(def.id)}
                  onAmountChange={v => setReliefs(prev => ({ ...prev, [def.id]: v }))}
                />
              ))}
            </div>

            <div className="mt-5 mb-3 text-[10px] uppercase tracking-widest text-foreground/45 font-medium">
              Other reliefs (if eligible)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {RELIEF_DEFS.filter(d => d.group === "other").map(def => (
                <ReliefCard
                  key={def.id}
                  def={def}
                  selected={selected.has(def.id)}
                  amount={reliefs[def.id] ?? 0}
                  onToggle={() => toggleRelief(def.id)}
                  onAmountChange={v => setReliefs(prev => ({ ...prev, [def.id]: v }))}
                />
              ))}
            </div>
          </section>

          {/* Donations section */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-foreground/45 mb-1 font-medium">
              Tax Deduction from Donations
            </div>
            <p className="text-xs text-foreground/50 mb-3 leading-relaxed">
              Donations to approved IPCs qualify for a 250% tax deduction — every $1 donated reduces chargeable income by $2.50. Not subject to the $80,000 relief cap.
            </p>
            <div className="glass-inset p-4 space-y-3">
              <div>
                <label className="block text-xs text-foreground/60 mb-1.5">Amount donated to approved IPCs</label>
                <div className="flex items-center gap-2 border-b border-foreground/20 pb-1">
                  <span className="text-sm font-mono text-foreground/60">$</span>
                  <input
                    type="number"
                    min={0}
                    value={donationAmount || ""}
                    placeholder="0"
                    onChange={e => setReliefs(prev => ({ ...prev, donation_amount: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 text-sm font-mono bg-transparent focus:outline-none text-foreground placeholder:text-foreground/25"
                  />
                </div>
              </div>
              {donationAmount > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-foreground/[0.08]">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/55">Donation amount</span>
                    <span className="font-mono">{fmtMoney(donationAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/55">× 2.5 deduction multiplier</span>
                    <span className="font-mono text-violet-600 dark:text-violet-400">−{fmtMoney(donationDeduction)}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-foreground/10 bg-background/60 backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/65">Total deductions applied</span>
            <span className={`font-mono font-semibold ${isCapped ? "text-amber-600 dark:text-amber-400" : (totalRelief + donationDeduction) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}`}>
              {fmtMoney(totalRelief + donationDeduction)}{isCapped ? " (reliefs capped)" : ""}
            </span>
          </div>
          <button
            onClick={handleSave}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors cursor-pointer"
          >
            Recalculate
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, valueClass = "", bold = false, small = false }: {
  label: string; value: string; valueClass?: string; bold?: boolean; small?: boolean;
}) {
  const textSize = small ? "text-xs" : "text-sm";
  return (
    <div className={`flex justify-between items-center ${textSize}`}>
      <span className={`font-sans ${bold ? "font-semibold text-foreground/85" : "text-foreground/65"}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${valueClass}`}>{value}</span>
    </div>
  );
}

function ReliefCard({
  def,
  selected,
  amount,
  onToggle,
  onAmountChange,
}: {
  def: ReliefDef;
  selected: boolean;
  amount: number;
  onToggle: () => void;
  onAmountChange: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wasSelected = useRef(false);

  useEffect(() => {
    if (selected && !wasSelected.current) inputRef.current?.focus();
    wasSelected.current = selected;
  }, [selected]);

  const isLapsed = !!def.lapsed;

  return (
    <div
      onClick={!isLapsed ? onToggle : undefined}
      className={`relative rounded-xl border p-3 transition-all duration-150 select-none min-h-[64px]
        ${isLapsed
          ? "opacity-40 cursor-not-allowed border-foreground/[0.08] bg-foreground/[0.01]"
          : selected
            ? "border-emerald-500/50 bg-emerald-500/[0.08] cursor-pointer"
            : "border-foreground/[0.12] bg-foreground/[0.02] hover:border-foreground/25 hover:bg-foreground/[0.04] cursor-pointer"
        }
      `}
    >
      {selected && !isLapsed && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shrink-0">
          <span className="text-white text-[9px] font-bold leading-none">✓</span>
        </div>
      )}
      <div className="pr-5">
        <div className={`text-xs font-medium leading-snug ${selected && !isLapsed ? "text-emerald-800 dark:text-emerald-300" : "text-foreground/80"}`}>
          {def.name}
        </div>
        {def.lapsed && (
          <div className="text-[10px] text-foreground/40 mt-0.5">Lapsed {def.lapsed}</div>
        )}
        {selected && !isLapsed && (
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1 border-b border-emerald-700/60 dark:border-emerald-500/60 pb-0.5">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">$</span>
              <input
                ref={inputRef}
                type="number"
                min={0}
                value={amount || ""}
                placeholder="0"
                onChange={e => onAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-mono bg-transparent focus:outline-none text-foreground placeholder:text-foreground/25 caret-emerald-700 dark:caret-emerald-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
