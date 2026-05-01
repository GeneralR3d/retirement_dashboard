"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildCpfProjection,
  CpfYearRow,
  CPF_OA_RATE,
  CPF_SA_RATE,
  CPF_MA_RATE,
  CPF_RA_RATE,
  CPF_TOTAL_CONTRIBUTION_RATE,
  CPF_FRS_INFLATION_RATE,
} from "@/lib/tax";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Stat, StatCard, Td, Th, InfoTooltip } from "@/app/components/ui";

function CpfTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div style={{ background: "var(--tooltip-bg, #0f172a)", border: "1px solid var(--grid-color, #1e293b)", borderRadius: 8, fontSize: 12, padding: "8px 12px" }}>
      <p className="mb-1 text-foreground/60 font-sans">Age {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtMoney(p.value)}</p>
      ))}
      <p className="font-semibold mt-1 pt-1 border-t border-foreground/20">Total: {fmtMoney(total)}</p>
    </div>
  );
}

type ColId =
  | "salary"
  | "totalContrib"
  | "oaContrib"
  | "saContrib"
  | "maContrib"
  | "oaBalance"
  | "saBalance"
  | "maBalance"
  | "raBalance";

const COLS: { id: ColId; label: string }[] = [
  { id: "salary",       label: "Gross Salary" },
  { id: "totalContrib", label: "Total Contribution" },
  { id: "oaContrib",    label: "OA Contribution" },
  { id: "saContrib",    label: "SA Contribution" },
  { id: "maContrib",    label: "MA Contribution" },
  { id: "oaBalance",    label: "OA Balance" },
  { id: "saBalance",    label: "SA Balance" },
  { id: "maBalance",    label: "MA Balance" },
  { id: "raBalance",    label: "RA Balance" },
];

function cellContent(id: ColId, r: CpfYearRow): React.ReactNode {
  switch (id) {
    case "salary":       return fmtMoney(r.salary);
    case "totalContrib": return fmtMoney(r.totalContribution);
    case "oaContrib":    return fmtMoney(r.oaContribution);
    case "saContrib":    return fmtMoney(r.saContribution);
    case "maContrib":    return fmtMoney(r.maContribution);
    case "oaBalance":    return fmtMoney(r.oaBalance);
    case "saBalance":    return fmtMoney(r.saBalance);
    case "maBalance":    return fmtMoney(r.maBalance);
    case "raBalance":    return fmtMoney(r.raBalance);
  }
}

function cellClassName(id: ColId): string {
  if (id === "oaBalance") return "text-blue-400";
  if (id === "saBalance") return "text-emerald-400";
  if (id === "maBalance") return "text-amber-400";
  if (id === "raBalance") return "text-yellow-400";
  return "";
}

export default function CpfPage() {
  const { inputs } = useProfile();
  const {
    currentAge,
    stopWorkingAge,
    cpfWithdrawalAge,
    cpfRetirementAge,
    startingSalary,
    salaryGrowthRate,
    cpfOA,
    cpfSA,
    cpfMA,
    cpfRA,
    cpfLifeFrs,
    cpfLifeMonthlyPayout,
    deathAge,
    salarySeries,
  } = inputs;

  const frsTarget = cpfLifeFrs * Math.pow(1 + CPF_FRS_INFLATION_RATE, Math.max(0, cpfRetirementAge - currentAge));
  const annualCpfLifePayout = cpfLifeMonthlyPayout * 12 * Math.pow(1 + CPF_FRS_INFLATION_RATE, Math.max(0, cpfWithdrawalAge - currentAge));

  const rows = useMemo(
    () =>
      buildCpfProjection({
        currentAge,
        stopWorkingAge,
        cpfWithdrawalAge,
        cpfRetirementAge,
        startingSalary,
        salaryGrowthRate,
        cpfOA,
        cpfSA,
        cpfMA,
        cpfRA,
        cpfLifeFrs,
        endAge: deathAge,
        salarySeries: salarySeries.length === Math.max(0, stopWorkingAge - currentAge) ? salarySeries : undefined,
      }),
    [currentAge, stopWorkingAge, cpfWithdrawalAge, cpfRetirementAge, startingSalary, salaryGrowthRate, cpfOA, cpfSA, cpfMA, cpfRA, cpfLifeFrs, deathAge, salarySeries],
  );

  const conversionRow = rows.find((r) => r.raConversionHappened);
  const cpfLifeRow = rows.find((r) => r.cpfLifeHappened);
  const cpfLifePremium = cpfLifeRow?.cpfLifePremium ?? 0;
  const years = Math.max(0, deathAge - currentAge);

  // How much OA was moved to cover a deficit, or how much excess went to OA
  const saBeforeConversion = conversionRow?.saBalanceAtConversion ?? 0;
  const conversionSurplus = saBeforeConversion - frsTarget; // positive = excess to OA, negative = deficit drawn from OA

  // OA is transferred to real networth at cpfRetirementAge — zero it out from that point
  const chartData = rows.map((r) => ({
    age: r.age,
    OA: conversionRow && r.age >= cpfRetirementAge ? 0 : Math.round(r.oaBalance),
    SA: Math.round(r.saBalance),
    MA: Math.round(r.maBalance),
    RA: Math.round(r.raBalance),
  }));

  const axisColor = "var(--axis-color, #94a3b8)";
  const gridColor = "var(--grid-color, #1e293b)";
  const refLineColor = "#a78bfa";
  const cpfLifeLineColor = "#f97316";

  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(
    () => new Set<ColId>(["oaBalance", "saBalance", "maBalance", "raBalance"]),
  );
  const [showHidden, setShowHidden] = useState(false);
  const [openMenu, setOpenMenu] = useState<ColId | null>(null);
  const thRefs = useRef<Partial<Record<ColId, HTMLTableCellElement>>>({});

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const inAnyTh = Object.values(thRefs.current).some(
        (el) => el && el.contains(e.target as Node),
      );
      if (!inAnyTh) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function toggleHiddenCol(id: ColId) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isVisible(id: ColId) {
    return !hiddenCols.has(id) || showHidden;
  }

  const hiddenCount = hiddenCols.size;
  const frsMet = conversionRow ? conversionSurplus >= 0 : false;

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-foreground/40 mb-1">
          OA {CPF_OA_RATE * 100}% · SA {CPF_SA_RATE * 100}% · MA {CPF_MA_RATE * 100}% · RA {CPF_RA_RATE * 100}% · Total contribution {CPF_TOTAL_CONTRIBUTION_RATE * 100}% of gross salary
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Central Provident Fund
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          CPF account growth from age {currentAge} to {deathAge} ({years} years).
          Contributions stop at age {stopWorkingAge}. SA converts to RA at age {cpfRetirementAge}.
        </p>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label={`FRS target at ${cpfRetirementAge}`}
          value={fmtMoney(frsTarget)}
          sub={conversionRow
            ? frsMet
              ? `Met · surplus ${fmtMoney(conversionSurplus)} → OA`
              : `Deficit ${fmtMoney(-conversionSurplus)} ← OA`
            : "No conversion in range"}
        />
        <StatCard
          label={`CPF LIFE premium at ${cpfWithdrawalAge}`}
          value={fmtMoney(cpfLifePremium)}
          sub="RA balance used to buy annuity"
        />
        <StatCard
          label="Annual CPF LIFE payout"
          value={fmtMoney(annualCpfLifePayout)}
          sub={`${fmtMoney(annualCpfLifePayout / 12)}/mo · fixed for life`}
          accent="emerald"
        />
      </section>

      {/* Chart */}
      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">Account composition over time</h2>
          <span className="text-xs text-foreground/60">
            Age {currentAge}–{deathAge}
          </span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis
                dataKey="age"
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                label={{ value: "Age", position: "insideBottomRight", offset: -5, fontSize: 11, fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CpfTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* Dotted reference line at SA→RA conversion age */}
              <ReferenceLine
                x={cpfRetirementAge}
                stroke={refLineColor}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: `SA→RA + OA→Brok (${cpfRetirementAge})`, position: "insideTopRight", fill: refLineColor, fontSize: 10 }}
              />
              {/* Dotted reference line at CPF LIFE annuity purchase age */}
              <ReferenceLine
                x={cpfWithdrawalAge}
                stroke={cpfLifeLineColor}
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: `CPF LIFE (${cpfWithdrawalAge})`, position: "insideTopLeft", fill: cpfLifeLineColor, fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="MA"
                stackId="a"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.55}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="SA"
                stackId="a"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.55}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="OA"
                stackId="a"
                stroke="#60a5fa"
                fill="#60a5fa"
                fillOpacity={0.55}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="RA"
                stackId="a"
                stroke="#eab308"
                fill="#eab308"
                fillOpacity={0.55}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* RA conversion summary */}
      {conversionRow && (
        <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5 mb-8">
          <h2 className="font-semibold mb-1">
            SA → RA conversion at age {cpfRetirementAge}
          </h2>
          <p className="text-xs text-foreground/60 mb-4">
            Special Account is transferred to Retirement Account to meet the
            FRS target (current {fmtMoney(cpfLifeFrs)} inflated at {CPF_FRS_INFLATION_RATE * 100}%/yr).
            Any surplus returns to OA; any deficit is drawn from OA.
            The remaining OA balance is then transferred in full to your investment account.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Stat label="FRS target" value={fmtMoney(frsTarget)} />
            <Stat
              label="SA at conversion"
              value={fmtMoney(saBeforeConversion)}
            />
            <Stat
              label={conversionSurplus >= 0 ? "Surplus → OA" : "Deficit ← OA"}
              value={`${conversionSurplus >= 0 ? "+" : ""}${fmtMoney(conversionSurplus)}`}
              accent={conversionSurplus >= 0 ? "emerald" : undefined}
            />
          </div>
        </section>
      )}

      {/* Annual projection table */}
      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-1.5">
            <h2 className="font-semibold">Annual projection</h2>
            <InfoTooltip>
              CPF allocation rates (OA / SA / MA splits) follow the official CPF Board schedule.{" "}
              <a
                href="https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline hover:text-sky-300"
              >
                View allocation rates (PDF)
              </a>
            </InfoTooltip>
          </span>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-md border border-foreground/15 hover:border-foreground/30 text-foreground/60 hover:text-foreground transition-colors"
            >
              {showHidden
                ? "Hide hidden columns"
                : `Show ${hiddenCount} hidden column${hiddenCount > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                {COLS.map((col) =>
                  isVisible(col.id) ? (
                    <th
                      key={col.id}
                      ref={(el) => {
                        if (el) thRefs.current[col.id] = el;
                      }}
                      className="py-2 px-2 font-medium whitespace-nowrap relative select-none"
                    >
                      <button
                        onClick={() =>
                          setOpenMenu((prev) =>
                            prev === col.id ? null : col.id,
                          )
                        }
                        className={`flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors ${
                          hiddenCols.has(col.id) ? "text-amber-400/70" : ""
                        }`}
                      >
                        {col.label}
                        <svg
                          className="w-3 h-3 opacity-50"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M3 4.5L6 7.5L9 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {openMenu === col.id && (
                        <div className="absolute top-full left-0 mt-1 z-20 rounded-lg border border-foreground/15 bg-[var(--tooltip-bg,#0f172a)] shadow-xl py-1 min-w-[160px]">
                          <button
                            onClick={() => {
                              toggleHiddenCol(col.id);
                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-foreground/10 transition-colors"
                          >
                            {hiddenCols.has(col.id)
                              ? "Remove from hidden"
                              : "Hide column"}
                          </button>
                        </div>
                      )}
                    </th>
                  ) : null,
                )}
                <Th>Total Balance</Th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr
                  key={r.year}
                  className={`border-b border-foreground/5 ${
                    r.raConversionHappened
                      ? "bg-violet-500/10"
                      : r.cpfLifeHappened
                      ? "bg-orange-500/10"
                      : "hover:bg-foreground/[0.04]"
                  }`}
                >
                  <Td>
                    <span>{r.age}</span>
                    {r.raConversionHappened && (
                      <>
                        <span className="ml-2 text-[10px] font-sans font-semibold text-violet-400 uppercase tracking-wide">
                          SA→RA
                        </span>
                        <span className="ml-1 text-[10px] font-sans font-semibold text-sky-400 uppercase tracking-wide">
                          OA→Brok
                        </span>
                      </>
                    )}
                    {r.cpfLifeHappened && (
                      <span className="ml-2 text-[10px] font-sans font-semibold text-orange-400 uppercase tracking-wide">
                        CPF LIFE
                      </span>
                    )}
                  </Td>
                  {COLS.map((col) =>
                    isVisible(col.id) ? (
                      <Td
                        key={col.id}
                        className={
                          hiddenCols.has(col.id)
                            ? "opacity-50 " + cellClassName(col.id)
                            : cellClassName(col.id)
                        }
                      >
                        {cellContent(col.id, r)}
                      </Td>
                    ) : null,
                  )}
                  <Td className="font-semibold">
                    {fmtMoney(conversionRow && r.age >= cpfRetirementAge
                      ? r.totalBalance - r.oaBalance
                      : r.totalBalance)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
