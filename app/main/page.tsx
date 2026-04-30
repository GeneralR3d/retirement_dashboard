"use client";

import { useMemo } from "react";
import { useSrsToggle } from "@/lib/srs-toggle-context";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildBrokerageProjection,
  buildCpfProjection,
  buildProjection,
  calculateSrsWithdrawal,
  CPF_FRS_INFLATION_RATE,
  SRS_WITHDRAWAL_YEARS,
} from "@/lib/tax";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard } from "@/app/components/ui";

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

type NetWorthPoint = {
  age: number;
  cpf: number;
  srs: number;
  brokerage: number;
  total: number;
};

function NetWorthTooltip({
  active,
  payload,
  label,
  stopWorkingAge,
  cpfRetirementAge,
  cpfWithdrawalAge,
  srsWithdrawalAge,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  stopWorkingAge: number;
  cpfRetirementAge: number;
  cpfWithdrawalAge: number;
  srsWithdrawalAge: number;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div
      style={{
        background: "var(--tooltip-bg, #0f172a)",
        border: "1px solid var(--grid-color, #1e293b)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 12px",
        minWidth: 200,
      }}
    >
      <p className="font-semibold mb-1 text-foreground/80">Age {label}</p>
      {[...payload].reverse().map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mt-0.5">
          {p.name}: {fmtMoney(p.value)}
        </p>
      ))}
      <p className="font-semibold mt-1 pt-1 border-t border-foreground/20">
        Total: {fmtMoney(total)}
      </p>
      {label === stopWorkingAge && (
        <p className="text-amber-400/80 mt-1 text-[11px]">Stop working</p>
      )}
      {label === cpfRetirementAge && (
        <p className="text-violet-400/80 mt-1 text-[11px]">
          CPF retirement · OA → brokerage
        </p>
      )}
      {label === cpfWithdrawalAge && (
        <p className="text-orange-400/80 mt-1 text-[11px]">CPF LIFE starts</p>
      )}
      {label === srsWithdrawalAge && (
        <p className="text-cyan-400/80 mt-1 text-[11px]">SRS withdrawals start</p>
      )}
    </div>
  );
}

function BrokerageTooltip({
  active,
  payload,
  label,
  cpfRetirementAge,
  stopWorkingAge,
  srsWithdrawalAge,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      balance: number;
      contribution: number | null;
      withdrawal: number | null;
      oaInjected: number | null;
      reinvestment: number | null;
    };
  }>;
  label?: number;
  cpfRetirementAge: number;
  stopWorkingAge: number;
  srsWithdrawalAge: number;
}) {
  if (!active || !payload?.length) return null;
  const { balance, contribution, withdrawal, oaInjected, reinvestment } =
    payload[0].payload;
  return (
    <div
      style={{
        background: "var(--tooltip-bg, #0f172a)",
        border: "1px solid var(--grid-color, #1e293b)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 12px",
        minWidth: 180,
      }}
    >
      <p className="font-semibold mb-1">Age {label}</p>
      <p className="text-emerald-400">Balance: {fmtMoney(balance)}</p>
      {contribution !== null && (
        <p className="text-foreground/60 mt-0.5">
          Annual contribution: {fmtMoney(contribution)}
        </p>
      )}
      {oaInjected !== null && (
        <p className="text-violet-400 mt-0.5">OA injected: {fmtMoney(oaInjected)}</p>
      )}
      {withdrawal !== null && (
        <p className="text-sky-400 mt-0.5">Annual withdrawal: {fmtMoney(withdrawal)}</p>
      )}
      {reinvestment !== null && (
        <p className="text-violet-400 mt-0.5">
          Surplus reinvested: {fmtMoney(reinvestment)}
        </p>
      )}
      {label === stopWorkingAge && (
        <p className="text-foreground/40 mt-1 text-[11px]">Last working year</p>
      )}
      {label === srsWithdrawalAge && (
        <p className="text-foreground/40 mt-1 text-[11px]">SRS withdrawals start</p>
      )}
      {label === cpfRetirementAge && !oaInjected && (
        <p className="text-foreground/40 mt-1 text-[11px]">
          OA transferred to brokerage
        </p>
      )}
    </div>
  );
}

function SrsToggleSwitch() {
  const { srsEnabled, setSrsEnabled } = useSrsToggle();
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-xs text-foreground/60">SRS</span>
      <button
        role="switch"
        aria-checked={srsEnabled}
        onClick={() => setSrsEnabled(!srsEnabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          srsEnabled ? "bg-emerald-500" : "bg-foreground/20"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            srsEnabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function MainPage() {
  const { inputs } = useProfile();
  const { srsEnabled } = useSrsToggle();
  const {
    currentAge,
    stopWorkingAge,
    cpfRetirementAge,
    cpfWithdrawalAge,
    deathAge,
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    investmentGrowthRateRetirement,
    livingExpensePct,
    srsWithdrawalAge,
    startingCash,
    cpfOA,
    cpfSA,
    cpfMA,
    cpfRA,
    cpfLifeFrs,
    cpfLifeMonthlyPayout,
    salarySeries,
    monthlyExpensesToday,
  } = inputs;

  const annualExpensesToday = monthlyExpensesToday * 12;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);
  const seriesOverride =
    salarySeries.length === workingYears ? salarySeries : undefined;

  const cpfLifeAnnualPayout =
    cpfLifeMonthlyPayout *
    12 *
    Math.pow(1 + CPF_FRS_INFLATION_RATE, cpfWithdrawalAge - currentAge);

  const { brokerageRows, oaAtRetirement, srsRowsForChart, netWorthData } =
    useMemo(() => {
      const srsYears = Math.max(
        workingYears,
        Math.max(0, srsWithdrawalAge - currentAge),
      );

      const srsRows = buildProjection({
        startingSalary,
        salaryGrowthRate,
        investmentGrowthRate,
        investmentGrowthRateRetirement,
        livingExpensePct,
        years: srsYears,
        workingYears,
        salarySeries: seriesOverride,
      });

      const cpfRows = buildCpfProjection({
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
        salarySeries: seriesOverride,
      });

      const convRow = cpfRows.find((r) => r.raConversionHappened);
      const oaBalance = convRow?.oaBalance ?? 0;

      const srsFinal = srsRows[srsRows.length - 1];
      const srsFinalPot = srsFinal?.srsPot ?? 0;
      const srsAnnualIncome =
        calculateSrsWithdrawal(srsFinalPot).netFromSrs / SRS_WITHDRAWAL_YEARS;
      const srsYearlyWithdrawal = srsFinalPot / SRS_WITHDRAWAL_YEARS;

      const rows = buildBrokerageProjection({
        startingCash,
        currentAge,
        workingYears,
        cpfRetirementAge,
        deathAge,
        investmentGrowthRate,
        investmentGrowthRateRetirement,
        srsRows,
        oaAtRetirement: oaBalance,
        stopWorkingAge,
        srsWithdrawalAge,
        cpfWithdrawalAge,
        cpfLifeAnnualPayout,
        srsAnnualIncome: srsEnabled ? srsAnnualIncome : 0,
        srsEnabled,
        annualExpensesToday,
      });

      // --- Net worth chart data ---

      // CPF map: age → net-CPF balance (OA excluded after transfer)
      const cpfMap = new Map<number, number>();
      cpfMap.set(currentAge, cpfOA + cpfSA + cpfMA + cpfRA);
      for (const r of cpfRows) {
        const val =
          convRow && r.age >= cpfRetirementAge
            ? r.totalBalance - r.oaBalance
            : r.totalBalance;
        cpfMap.set(r.age, Math.max(0, val));
      }

      // SRS map: age → SRS pot balance (all zeros when SRS is disabled)
      const srsMap = new Map<number, number>();
      if (srsEnabled) {
        srsMap.set(currentAge, 0);
        for (let i = 0; i < srsRows.length; i++) {
          const age = currentAge + i + 1;
          if (age <= srsWithdrawalAge) {
            srsMap.set(age, srsRows[i].srsPot);
          }
        }
        for (let k = 1; k <= Math.max(0, deathAge - srsWithdrawalAge); k++) {
          srsMap.set(
            srsWithdrawalAge + k,
            Math.max(0, srsFinalPot - srsYearlyWithdrawal * k),
          );
        }
      }

      // Brokerage map: age → balance
      const brokerageMap = new Map<number, number>();
      for (const r of rows) {
        brokerageMap.set(r.age, Math.max(0, r.balance));
      }

      // Merge into net worth array
      const totalYears = Math.max(0, deathAge - currentAge);
      const nwData: NetWorthPoint[] = Array.from(
        { length: totalYears + 1 },
        (_, i) => {
          const age = currentAge + i;
          const cpf = cpfMap.get(age) ?? 0;
          const srs = srsMap.get(age) ?? 0;
          const brokerage = brokerageMap.get(age) ?? 0;
          return {
            age,
            cpf: Math.round(cpf),
            srs: Math.round(srs),
            brokerage: Math.round(brokerage),
            total: Math.round(cpf + srs + brokerage),
          };
        },
      );

      return {
        brokerageRows: rows,
        oaAtRetirement: oaBalance,
        srsRowsForChart: srsRows,
        netWorthData: nwData,
      };
    }, [
      currentAge,
      stopWorkingAge,
      cpfRetirementAge,
      cpfWithdrawalAge,
      deathAge,
      startingSalary,
      salaryGrowthRate,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      livingExpensePct,
      srsWithdrawalAge,
      startingCash,
      cpfOA,
      cpfSA,
      cpfMA,
      cpfRA,
      cpfLifeFrs,
      workingYears,
      seriesOverride,
      cpfLifeAnnualPayout,
      srsEnabled,
      annualExpensesToday,
    ]);

  const chartData = useMemo(
    () =>
      brokerageRows.map((r, k) => ({
        age: r.age,
        balance: Math.round(r.balance),
        contribution:
          k > 0 && k - 1 < workingYears
            ? Math.round(
                srsEnabled
                  ? (srsRowsForChart[k - 1]?.brokerageWithSrs ?? 0)
                  : (srsRowsForChart[k - 1]?.investedNoSrs ?? 0),
              )
            : null,
        withdrawal: r.brokerageIncome > 0 ? Math.round(r.brokerageIncome) : null,
        oaInjected:
          r.age === cpfRetirementAge && oaAtRetirement > 0
            ? Math.round(oaAtRetirement)
            : null,
        reinvestment: r.srsReinvestment > 0 ? Math.round(r.srsReinvestment) : null,
      })),
    [brokerageRows, srsRowsForChart, workingYears, cpfRetirementAge, oaAtRetirement, srsEnabled],
  );

  const peakRow = brokerageRows.reduce(
    (best, r) => (r.balance > best.balance ? r : best),
    brokerageRows[0],
  );
  const finalBalance = brokerageRows[brokerageRows.length - 1]?.balance ?? 0;

  // Retirement viability: check if brokerage ever hits 0 after stopWorkingAge
  const runOutRow = brokerageRows.find(
    (r) => r.age > stopWorkingAge && r.balance <= 0,
  );
  const canRetire = runOutRow === undefined;

  const peakNwRow = netWorthData.reduce(
    (best, r) => (r.total > best.total ? r : best),
    netWorthData[0] ?? { age: currentAge, total: 0 },
  );
  const finalNw = netWorthData[netWorthData.length - 1]?.total ?? 0;

  const gridColor = "var(--grid-color)";
  const axisColor = "var(--axis-color)";

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-foreground/60 text-sm mt-1">
          Net worth across CPF, SRS, and real brokerage — age {currentAge} to {deathAge}.
        </p>
      </header>

      {/* Retirement verdict banner */}
      <div className="mb-8 text-center">
        {canRetire ? (
          <h2 className="text-2xl font-semibold text-emerald-400">
            You can retire at age{" "}
            <span className="text-4xl font-black italic">{stopWorkingAge}</span>
          </h2>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-red-400">
              You cannot retire at age{" "}
              <span className="text-4xl font-black italic">{stopWorkingAge}</span>
            </h2>
            <p className="text-sm text-red-400/70 mt-1">
              You will run out of money at age {runOutRow!.age}
            </p>
          </>
        )}
      </div>

      {/* Net worth KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Net worth today"
          value={fmtMoney(netWorthData[0]?.total ?? 0)}
          sub={`at age ${currentAge}`}
        />
        <StatCard
          label="Peak net worth"
          value={fmtMoney(peakNwRow.total)}
          sub={`at age ${peakNwRow.age}`}
          accent="emerald"
        />
        <StatCard
          label={`Net worth at ${deathAge}`}
          value={fmtMoney(finalNw)}
          sub="end of plan"
        />
        <StatCard
          label="OA transfer at retirement"
          value={fmtMoney(oaAtRetirement)}
          sub={`at age ${cpfRetirementAge}`}
        />
      </div>

      {/* Net Worth Chart */}
      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Net Worth Breakdown</h2>
          <div className="flex items-center gap-4">
            <SrsToggleSwitch />
            <span className="text-xs text-foreground/60">
              Age {currentAge}–{deathAge}
            </span>
          </div>
        </div>
        <p className="text-foreground/60 text-xs mb-6">
          CPF (OA excluded after age {cpfRetirementAge}), SRS pot (drawn down over 10 yrs from age{" "}
          {srsWithdrawalAge}), real brokerage, and combined total.
        </p>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart
            data={netWorthData}
            margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 12, fill: axisColor }}
              label={{
                value: "Age",
                position: "insideBottomRight",
                offset: -8,
                fill: axisColor,
                fontSize: 12,
              }}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={{ fontSize: 12, fill: axisColor }}
              width={72}
              domain={[0, Math.ceil((peakNwRow.total * 1.1) / 500_000) * 500_000]}
            />
            <Tooltip
              content={
                <NetWorthTooltip
                  stopWorkingAge={stopWorkingAge}
                  cpfRetirementAge={cpfRetirementAge}
                  cpfWithdrawalAge={cpfWithdrawalAge}
                  srsWithdrawalAge={srsWithdrawalAge}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            {/* Milestone reference lines */}
            {stopWorkingAge !== cpfRetirementAge && (
              <ReferenceLine
                x={stopWorkingAge}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Retire (${stopWorkingAge})`,
                  position: "insideTopRight",
                  fill: "#f59e0b",
                  fontSize: 10,
                }}
              />
            )}
            <ReferenceLine
              x={cpfRetirementAge}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value:
                  stopWorkingAge === cpfRetirementAge
                    ? `Retire / OA→Brok (${cpfRetirementAge})`
                    : `OA→Brok (${cpfRetirementAge})`,
                position: "insideTopLeft",
                fill: "#8b5cf6",
                fontSize: 10,
              }}
            />
            {srsEnabled && (
              <ReferenceLine
                x={srsWithdrawalAge}
                stroke="#22d3ee"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `SRS starts (${srsWithdrawalAge})`,
                  position: "insideTopRight",
                  fill: "#22d3ee",
                  fontSize: 10,
                }}
              />
            )}
            <ReferenceLine
              x={cpfWithdrawalAge}
              stroke="#f97316"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `CPF LIFE (${cpfWithdrawalAge})`,
                position: "insideTopLeft",
                fill: "#f97316",
                fontSize: 10,
              }}
            />

            <Line type="monotone" dataKey="total" name="Total Net Worth" stroke="#f8fafc" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="brokerage" name="Brokerage" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
            {srsEnabled && (
              <Line type="monotone" dataKey="srs" name="SRS Pot" stroke="#10b981" strokeWidth={1.5} dot={false} />
            )}
            <Line type="monotone" dataKey="cpf" name="CPF" stroke="#eab308" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Brokerage KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Starting cash" value={fmtMoney(startingCash)} />
        <StatCard
          label="OA transfer at retirement"
          value={fmtMoney(oaAtRetirement)}
          sub={`at age ${cpfRetirementAge}`}
        />
        <StatCard
          label="Peak brokerage balance"
          value={fmtMoney(peakRow?.balance ?? 0)}
          sub={`at age ${peakRow?.age ?? "—"}`}
          accent="emerald"
        />
        <StatCard
          label={`Brokerage at ${deathAge}`}
          value={fmtMoney(finalBalance)}
        />
      </div>

      {/* Brokerage Chart */}
      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-6">
        <h2 className="font-semibold mb-1">Real Brokerage Account</h2>
        <p className="text-foreground/60 text-xs mb-6">
          Contributions: annual brokerage surplus (with SRS) during working years. OA
          balance injected at age {cpfRetirementAge}. Growth: {(investmentGrowthRate * 100).toFixed(1)}% until
          retirement, {(investmentGrowthRateRetirement * 100).toFixed(1)}% after.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400/90 mb-6">
          <span className="mt-px shrink-0">⚠</span>
          <span>
            <strong>Assumption:</strong> combined cash + brokerage earning a flat{" "}
            <strong>{(investmentGrowthRate * 100).toFixed(1)}% p.a.</strong> (pre-retirement) /{" "}
            <strong>{(investmentGrowthRateRetirement * 100).toFixed(1)}% p.a.</strong>{" "}
            (post-retirement) — infinitely liquid, no spreads or cash-drag modelled.
          </span>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 12, fill: axisColor }}
              label={{
                value: "Age",
                position: "insideBottomRight",
                offset: -8,
                fill: axisColor,
                fontSize: 12,
              }}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={{ fontSize: 12, fill: axisColor }}
              width={72}
            />
            <Tooltip
              content={
                <BrokerageTooltip
                  cpfRetirementAge={cpfRetirementAge}
                  stopWorkingAge={stopWorkingAge}
                  srsWithdrawalAge={srsWithdrawalAge}
                />
              }
            />
            {stopWorkingAge !== cpfRetirementAge && (
              <ReferenceLine
                x={stopWorkingAge}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: "Retire",
                  position: "insideTopRight",
                  fill: "#f59e0b",
                  fontSize: 11,
                }}
              />
            )}
            <ReferenceLine
              x={cpfRetirementAge}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              label={{
                value:
                  stopWorkingAge === cpfRetirementAge
                    ? "Retire / OA Transfer"
                    : "OA Transfer",
                position: "insideTopLeft",
                fill: "#8b5cf6",
                fontSize: 11,
              }}
            />
            {srsEnabled && (
              <ReferenceLine
                x={srsWithdrawalAge}
                stroke="#22d3ee"
                strokeDasharray="4 4"
                label={{
                  value: "SRS starts",
                  position: "insideTopRight",
                  fill: "#22d3ee",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              name="Real Brokerage"
            />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </main>
  );
}
