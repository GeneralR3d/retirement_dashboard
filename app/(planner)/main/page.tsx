"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
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
import { buildFullProjection } from "@/lib/projection";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, MilestoneLegend } from "@/app/components/ui";
import SmartSummary from "@/app/components/smart-summary";

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

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
  const totalEntry = payload.find((p) => p.name === "Total Net Worth");
  const components = payload.filter((p) => p.name !== "Total Net Worth");
  const total = totalEntry?.value ?? components.reduce((s, p) => s + (p.value ?? 0), 0);
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
      {[...components].reverse().map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mt-0.5">
          {p.name}: {fmtMoney(p.value)}
        </p>
      ))}
      <p className="font-semibold mt-1 pt-1 border-t border-foreground/20">
        Total: {fmtMoney(total)}
      </p>
      {label === stopWorkingAge && (
        <p className="text-amber-700 dark:text-amber-400/80 mt-1 text-[11px]">Stop working</p>
      )}
      {label === cpfRetirementAge && (
        <p className="text-violet-700 dark:text-violet-400/80 mt-1 text-[11px]">
          CPF retirement · OA → brokerage
        </p>
      )}
      {label === cpfWithdrawalAge && (
        <p className="text-orange-700 dark:text-orange-400/80 mt-1 text-[11px]">CPF LIFE starts</p>
      )}
      {label === srsWithdrawalAge && (
        <p className="text-cyan-700 dark:text-cyan-400/80 mt-1 text-[11px]">SRS withdrawals start</p>
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
      <p className="text-emerald-600 dark:text-emerald-400">Balance: {fmtMoney(balance)}</p>
      {contribution !== null && (
        <p className="text-foreground/85 dark:text-foreground/60 mt-0.5">
          Annual contribution: {fmtMoney(contribution)}
        </p>
      )}
      {oaInjected !== null && (
        <p className="text-violet-700 dark:text-violet-400 mt-0.5">OA injected: {fmtMoney(oaInjected)}</p>
      )}
      {withdrawal !== null && (
        <p className="text-sky-700 dark:text-sky-400 mt-0.5">Annual withdrawal: {fmtMoney(withdrawal)}</p>
      )}
      {reinvestment !== null && (
        <p className="text-violet-700 dark:text-violet-400 mt-0.5">
          Surplus reinvested: {fmtMoney(reinvestment)}
        </p>
      )}
      {label === stopWorkingAge && (
        <p className="text-foreground/65 dark:text-foreground/40 mt-1 text-[11px]">Last working year</p>
      )}
      {label === srsWithdrawalAge && (
        <p className="text-foreground/65 dark:text-foreground/40 mt-1 text-[11px]">SRS withdrawals start</p>
      )}
      {label === cpfRetirementAge && !oaInjected && (
        <p className="text-foreground/65 dark:text-foreground/40 mt-1 text-[11px]">
          OA transferred to brokerage
        </p>
      )}
    </div>
  );
}

function SimpleTooltip({
  active,
  payload,
  label,
  color,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--tooltip-bg, #0f172a)",
        border: "1px solid var(--grid-color, #1e293b)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 12px",
        minWidth: 160,
      }}
    >
      <p className="font-semibold mb-1">Age {label}</p>
      <p style={{ color }}>{fmtMoney(payload[0].value)}</p>
    </div>
  );
}

function SrsTooltip({
  active,
  payload,
  label,
  srsWithdrawalAge,
  stopWorkingAge,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { srs: number; contribution: number | null } }>;
  label?: number;
  srsWithdrawalAge: number;
  stopWorkingAge: number;
}) {
  if (!active || !payload?.length) return null;
  const { srs, contribution } = payload[0].payload;
  const isDrawdown = (label ?? 0) > srsWithdrawalAge;
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
      <p className="text-emerald-600 dark:text-emerald-400">Pot balance: {fmtMoney(srs)}</p>
      {contribution !== null && contribution > 0 && (
        <p className="text-emerald-700 dark:text-emerald-300/70 mt-0.5">Annual top-up: {fmtMoney(contribution)}</p>
      )}
      {contribution !== null && contribution === 0 && (label ?? 0) <= stopWorkingAge && (
        <p className="text-foreground/65 dark:text-foreground/40 mt-0.5">No top-up this year</p>
      )}
      {isDrawdown && (
        <p className="text-cyan-700 dark:text-cyan-400/70 mt-0.5 text-[11px]">Drawdown phase</p>
      )}
    </div>
  );
}

export default function MainPage() {
  const { inputs, saveCount } = useProfile();
  const {
    currentAge,
    stopWorkingAge,
    cpfRetirementAge,
    cpfWithdrawalAge,
    deathAge,
    investmentGrowthRate,
    investmentGrowthRateRetirement,
    srsWithdrawalAge,
    startingCash,
    monthlyExpensesToday,
    monthlyExpensesRetirement,
    monthlyExpenseSeries,
    cash,
  } = inputs;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);

  const {
    brokerageRows,
    oaAtRetirement,
    oaTransferAge,
    srsPotData,
    cashData,
    srsPotAtWithdrawal,
    srsWithdrawal,
    netWorthData,
    brokerageContributions,
    peakRow,
    retirementBrokerageBalance,
    runOutRow,
    canRetire,
    peakNwRow,
    summary,
  } = useMemo(() => buildFullProjection(inputs), [inputs]);

  const brokerageChartData = useMemo(
    () =>
      brokerageRows.map((r, k) => ({
        age: r.age,
        balance: Math.round(r.balance),
        contribution: k > 0 && k - 1 < workingYears ? Math.round(brokerageContributions[k - 1] ?? 0) : null,
        withdrawal: r.brokerageIncome > 0 ? Math.round(r.brokerageIncome) : null,
        oaInjected:
          r.age === oaTransferAge && oaAtRetirement > 0
            ? Math.round(oaAtRetirement)
            : null,
        reinvestment: r.srsReinvestment > 0 ? Math.round(r.srsReinvestment) : null,
      })),
    [brokerageRows, brokerageContributions, workingYears, oaTransferAge, oaAtRetirement],
  );

  const gridColor = "var(--grid-color)";
  const axisColor = "var(--axis-color)";

  // Age-milestone reference lines are rendered without on-chart labels; the
  // labels live in a MilestoneLegend below each chart to avoid overlap.
  const nwMilestoneItems = [
    ...(stopWorkingAge !== cpfRetirementAge
      ? [{ label: `Retire (${stopWorkingAge})`, color: "var(--chart-stop)" }]
      : []),
    {
      label: stopWorkingAge === cpfRetirementAge
        ? `Retire / OA→Brok (${cpfRetirementAge})`
        : `OA→Brok (${cpfRetirementAge})`,
      color: "var(--chart-cpf-ret)",
    },
    { label: `SRS starts (${srsWithdrawalAge})`, color: "var(--chart-cpf-wit)" },
    { label: `CPF LIFE (${cpfWithdrawalAge})`, color: "var(--chart-srs-wit)" },
  ];
  const brokerageMilestoneItems = [
    ...(stopWorkingAge !== cpfRetirementAge
      ? [{ label: "Retire", color: "var(--chart-stop)" }]
      : []),
    {
      label: stopWorkingAge === cpfRetirementAge ? "Retire / OA Transfer" : "OA Transfer",
      color: "var(--chart-cpf-ret)",
    },
    { label: "SRS starts", color: "var(--chart-cpf-wit)" },
  ];
  const srsMilestoneItems = [
    { label: `Stop work (${stopWorkingAge})`, color: "var(--chart-stop)" },
    { label: `Withdrawals start (${srsWithdrawalAge})`, color: "var(--chart-cpf-wit)" },
  ];
  const cashMilestoneItems = [
    { label: `Retire (${stopWorkingAge})`, color: "var(--chart-stop)" },
  ];

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Networth</h1>
        <p className="text-foreground/85 dark:text-foreground/60 text-sm mt-1">
          Net worth across CPF, SRS, and investments — age {currentAge} to {deathAge}.
        </p>
      </header>


      {/* Verdict title + streaming Smart Summary — centred, always visible */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="text-center py-4">
          {canRetire ? (
            <h2 className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              You can retire at age{" "}
              <span className="text-4xl font-black italic">{stopWorkingAge}</span>
            </h2>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400">
                You cannot retire at age{" "}
                <span className="text-4xl font-black italic">{stopWorkingAge}</span>
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400/70 mt-1">
                You will run out of money at age {runOutRow!.age}
              </p>
            </>
          )}
        </div>

        <div className="mt-4">
          <SmartSummary
            embedded
            open
            canRetire={canRetire}
            stopWorkingAge={stopWorkingAge}
            runOutAge={runOutRow?.age}
            currentAge={currentAge}
            deathAge={deathAge}
            monthlyExpensesToday={monthlyExpensesToday}
            monthlyExpensesRetirement={monthlyExpensesRetirement}
            monthlyExpenseSeries={monthlyExpenseSeries}
            retirementBrokerageBalance={retirementBrokerageBalance}
            peakBrokerageBalance={peakRow?.balance ?? 0}
            peakBrokerageAge={peakRow?.age ?? stopWorkingAge}
            oaTransferAge={oaTransferAge}
            cpfWithdrawalAge={cpfWithdrawalAge}
            data={summary}
            targetWidth={0}
            generationKey={saveCount}
          />
        </div>
      </div>

      {/* KPI cards — always full width, unaffected by the panel */}
      <div className="grid grid-cols-2 gap-4 mb-8">
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
      </div>

      {/* Net Worth Chart */}
      <section className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Net Worth Breakdown</h2>
          <span className="text-xs text-foreground/85 dark:text-foreground/60">
            Age {currentAge}–{deathAge}
          </span>
        </div>
        <p className="text-foreground/85 dark:text-foreground/60 text-xs mb-6">
          CPF (OA excluded after age {cpfRetirementAge}), SRS pot (drawn down over 10 yrs from age{" "}
          {srsWithdrawalAge}), investments, and combined total.
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

            {stopWorkingAge !== cpfRetirementAge && (
              <ReferenceLine
                x={stopWorkingAge}
                stroke="var(--chart-stop)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            <ReferenceLine
              x={cpfRetirementAge}
              stroke="var(--chart-cpf-ret)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <ReferenceLine
              x={srsWithdrawalAge}
              stroke="var(--chart-cpf-wit)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <ReferenceLine
              x={cpfWithdrawalAge}
              stroke="var(--chart-srs-wit)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />

            <Line type="monotone" dataKey="total" name="Total Net Worth" stroke="var(--chart-total)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="brokerage" name="Investments" stroke="var(--chart-inv)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="srs" name="SRS Pot" stroke="var(--chart-srs)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cpf" name="CPF" stroke="var(--chart-cpf)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cash" name="Cash" stroke="var(--chart-cash)" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <MilestoneLegend items={nwMilestoneItems} />
      </section>

      {/* Brokerage Chart */}
      <section className="glass-card p-6">
        <h2 className="font-semibold mb-1">Investment Account</h2>
        <p className="text-foreground/85 dark:text-foreground/60 text-xs mb-4">
          OA balance injected at age {cpfRetirementAge}.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard label="Brokerage seed" value={fmtMoney(startingCash)} />
          <StatCard
            label="Peak brokerage balance"
            value={fmtMoney(peakRow?.balance ?? 0)}
            sub={`at age ${peakRow?.age ?? "—"}`}
            accent="emerald"
          />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400/90 mb-6">
          <span className="mt-px shrink-0">⚠</span>
          <span>
            Combined investments earning{" "}
            <strong>{(investmentGrowthRate * 100).toFixed(1)}% p.a.</strong> (pre-retirement) /{" "}
            <strong>{(investmentGrowthRateRetirement * 100).toFixed(1)}% p.a.</strong>{" "}
            (post-retirement).
          </span>
        </div>
        {(() => {
          const balances = brokerageChartData.map((d) => d.balance);
          const minBal = Math.min(...balances);
          const maxBal = Math.max(...balances);
          const hasNegative = minBal < 0;
          const zeroOffset = hasNegative ? maxBal / (maxBal - minBal) : 1;
          return (
            <ResponsiveContainer width="100%" height={420}>
              <AreaChart data={brokerageChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-srs)" stopOpacity={0.25} />
                    <stop offset={`${zeroOffset * 100}%`} stopColor="var(--chart-srs)" stopOpacity={0.1} />
                    {hasNegative && (
                      <stop offset={`${zeroOffset * 100}%`} stopColor="#ef4444" stopOpacity={0.15} />
                    )}
                    {hasNegative && (
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                    )}
                  </linearGradient>
                  <linearGradient id="balanceStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-srs)" />
                    <stop offset={`${zeroOffset * 100}%`} stopColor="var(--chart-srs)" />
                    {hasNegative && (
                      <stop offset={`${zeroOffset * 100}%`} stopColor="#ef4444" />
                    )}
                    {hasNegative && (
                      <stop offset="100%" stopColor="#ef4444" />
                    )}
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 12, fill: axisColor }}
                  label={{ value: "Age", position: "insideBottomRight", offset: -8, fill: axisColor, fontSize: 12 }}
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
                    stroke="var(--chart-stop)"
                    strokeDasharray="4 4"
                  />
                )}
                <ReferenceLine
                  x={cpfRetirementAge}
                  stroke="var(--chart-cpf-ret)"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  x={srsWithdrawalAge}
                  stroke="var(--chart-cpf-wit)"
                  strokeDasharray="4 4"
                />
                {hasNegative && (
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
                )}
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="url(#balanceStroke)"
                  strokeWidth={2.5}
                  fill="url(#balanceGradient)"
                  dot={false}
                  name="Investments"
                />
              </AreaChart>
            </ResponsiveContainer>
          );
        })()}
        <MilestoneLegend items={brokerageMilestoneItems} />
      </section>

      {/* SRS Pot Chart */}
      <section className="glass-card p-6 mb-8 mt-8">
        <h2 className="font-semibold mb-1">SRS Account</h2>
        <p className="text-foreground/85 dark:text-foreground/60 text-xs mb-4">
          Contributions optimised to reduce tax brackets each year. Pot grows at{" "}
          {(investmentGrowthRate * 100).toFixed(1)}% (pre-retirement) /{" "}
          {(investmentGrowthRateRetirement * 100).toFixed(1)}% (post-retirement). Drawdown over 10 years from age {srsWithdrawalAge}.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label={`SRS pot at age ${srsWithdrawalAge}`}
            value={fmtMoney(srsPotAtWithdrawal)}
            accent="emerald"
          />
          <StatCard
            label="Yearly withdrawal"
            value={fmtMoney(srsWithdrawal.yearlyWithdrawal)}
            sub="× 10 years"
          />
          <StatCard
            label="Tax per year"
            value={fmtMoney(srsWithdrawal.taxPerYear)}
            sub="50% of withdrawal taxable"
          />
          <StatCard
            label="Yearly withdrawal after tax"
            value={fmtMoney(srsWithdrawal.yearlyWithdrawal - srsWithdrawal.taxPerYear)}
            sub={`total ${fmtMoney(srsWithdrawal.netFromSrs)}`}
          />
        </div>
        {(() => {
          const srsBalances = srsPotData.map((d) => d.srs);
          const maxSrs = Math.max(...srsBalances, 1);
          return (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={srsPotData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="srsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-srs)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-srs)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 12, fill: axisColor }}
                  label={{ value: "Age", position: "insideBottomRight", offset: -8, fill: axisColor, fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={fmtAxis}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={72}
                  domain={[0, Math.ceil((maxSrs * 1.1) / 100_000) * 100_000]}
                />
                <Tooltip content={<SrsTooltip srsWithdrawalAge={srsWithdrawalAge} stopWorkingAge={stopWorkingAge} />} />
                <ReferenceLine
                  x={stopWorkingAge}
                  stroke="var(--chart-stop)"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  x={srsWithdrawalAge}
                  stroke="var(--chart-cpf-wit)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="srs"
                  name="SRS Pot"
                  stroke="var(--chart-srs)"
                  strokeWidth={2}
                  fill="url(#srsGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          );
        })()}
        <MilestoneLegend items={srsMilestoneItems} />
      </section>

      {/* Cash Chart */}
      <section className="glass-card p-6 mb-8">
        <h2 className="font-semibold mb-1">Cash Reserve</h2>
        <p className="text-foreground/85 dark:text-foreground/60 text-xs mb-4">
          Emergency fund targeting {inputs.emergencyMonths} months of expenses. 0% interest.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Cash today"
            value={fmtMoney(cash)}
            sub="zero-interest reserve"
          />
          <StatCard
            label={`Cash at retirement (${stopWorkingAge})`}
            value={fmtMoney(cashData.find((d) => d.age === stopWorkingAge)?.cash ?? cash)}
            sub={`${inputs.emergencyMonths} months target`}
          />
        </div>
        {(() => {
          const cashBalances = cashData.map((d) => d.cash);
          const maxCash = Math.max(...cashBalances, 1);
          return (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cashData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-cash)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-cash)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 12, fill: axisColor }}
                  label={{ value: "Age", position: "insideBottomRight", offset: -8, fill: axisColor, fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={fmtAxis}
                  tick={{ fontSize: 12, fill: axisColor }}
                  width={72}
                  domain={[0, Math.ceil((maxCash * 1.2) / 10_000) * 10_000]}
                />
                <Tooltip content={<SimpleTooltip color="var(--chart-cash)" />} />
                <ReferenceLine
                  x={stopWorkingAge}
                  stroke="var(--chart-stop)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="cash"
                  name="Cash"
                  stroke="var(--chart-cash)"
                  strokeWidth={2}
                  fill="url(#cashGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          );
        })()}
        <MilestoneLegend items={cashMilestoneItems} />
      </section>
    </main>
  );
}
