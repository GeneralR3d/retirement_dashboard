"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
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
import {
  buildBrokerageProjection,
  buildCpfProjection,
  calculateSrsWithdrawal,
  CPF_FRS_INFLATION_RATE,
  CPF_EMPLOYEE_RATE,
  SRS_WITHDRAWAL_YEARS,
  recommendedSrsTopUp,
  SRS_ANNUAL_CAP,
} from "@/lib/tax";
import { buildAccumulation } from "@/lib/cash-flow";
import { computeBtoBreakdown, computeMortgageCashPayments } from "@/lib/bto";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, StaggeredLabel } from "@/app/components/ui";
import SmartSummary from "@/app/components/smart-summary";

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
  cash: number;
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
  const { inputs } = useProfile();
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
    monthlyExpensesRetirement,
    monthlyExpenseSeries,
    emergencyMonths,
    lumpsumExpenses,
    lumpsumInflows,
    cash,
    srsAnnualCap,
    srsAccepted,
    btoFlatPrice,
    btoApplicationAge,
    btoCollectionAge,
    btoLoanTenureYears,
  } = inputs;

  const annualExpensesToday = monthlyExpensesRetirement * 12;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);
  const seriesOverride =
    salarySeries.length === workingYears ? salarySeries : undefined;

  const { brokerageRows, oaAtRetirement, oaTransferAge, srsPotData, cashData, srsPotAtWithdrawal, srsWithdrawal, netWorthData, brokerageContributions, cpfRows, cpfLifeAnnualPayout, allMortgagePayments } =
    useMemo(() => {
      // Compute recommended SRS top-ups per year, honouring per-year accept/reject from context.
      const srsTopUps = Array.from({ length: workingYears }, (_, i) => {
        const accepted = i < srsAccepted.length ? srsAccepted[i] : true;
        if (!accepted) return 0;
        const salary = seriesOverride?.[i] ?? startingSalary * Math.pow(1 + salaryGrowthRate, i);
        const takeHome = salary * (1 - CPF_EMPLOYEE_RATE);
        return recommendedSrsTopUp(takeHome, srsAnnualCap ?? SRS_ANNUAL_CAP).topUp;
      });

      const allMortgagePayments = computeMortgageCashPayments(inputs);
      const workingMortgageLumpsums = allMortgagePayments
        .filter((p) => p.age >= currentAge && p.age < stopWorkingAge)
        .map((p) => ({ id: `bto-mtg-${p.age}`, age: p.age, name: "BTO Mortgage", amount: p.amount }));

      const retirementMortgageByAge = new Map<number, number>();
      for (const p of allMortgagePayments) {
        if (p.age >= stopWorkingAge && p.age <= deathAge) retirementMortgageByAge.set(p.age, p.amount);
      }

      const accRows = buildAccumulation({
        currentAge,
        stopWorkingAge,
        startingSalary,
        salaryGrowthRate,
        salarySeries: seriesOverride,
        monthlyExpensesToday,
        monthlyExpenseSeries:
          monthlyExpenseSeries.length === workingYears ? monthlyExpenseSeries : undefined,
        emergencyMonths,
        lumpsumExpenses: [...lumpsumExpenses, ...workingMortgageLumpsums],
        lumpsumInflows,
        cashStart: cash,
        brokerageStart: startingCash,
        investmentGrowthRate,
        srsTopUps,
      });

      // Compute SRS pot year by year from acc rows
      let srsPotRunning = 0;
      const srsPotByAge = new Map<number, number>();
      srsPotByAge.set(currentAge, 0);

      for (let i = 0; i < workingYears; i++) {
        srsPotRunning = (srsPotRunning + accRows[i].srsTopUp) * (1 + investmentGrowthRate);
        srsPotByAge.set(currentAge + i + 1, srsPotRunning);
      }

      // After working years: grow at retirement rate until srsWithdrawalAge (no new contributions)
      const postWorkGrowYears = Math.max(0, srsWithdrawalAge - stopWorkingAge);
      for (let j = 0; j < postWorkGrowYears; j++) {
        srsPotRunning = srsPotRunning * (1 + investmentGrowthRateRetirement);
        srsPotByAge.set(stopWorkingAge + j + 1, srsPotRunning);
      }

      const finalSrsPot = srsPotRunning;
      const w = calculateSrsWithdrawal(finalSrsPot);
      const srsAnnualIncome = w.netFromSrs / SRS_WITHDRAWAL_YEARS;
      const srsYearlyWithdrawal = finalSrsPot / SRS_WITHDRAWAL_YEARS;

      const cpfBaseInputs = {
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
      };

      let cpfRows;
      if (btoFlatPrice <= 0) {
        cpfRows = buildCpfProjection(cpfBaseInputs);
      } else {
        // Pass 1: no deductions — get OA at DP1 age
        const pass1 = buildCpfProjection(cpfBaseInputs);
        const oaAtDp1Age = pass1.find((r) => r.age === btoApplicationAge)?.oaBalance ?? 0;

        // DP1 allocation only depends on oaAtDp1Age
        const btoPass1 = computeBtoBreakdown(inputs, oaAtDp1Age, 0);
        const dp1Deductions: { age: number; amount: number }[] = [];
        if (btoPass1.dp1.fromOA > 0 && btoApplicationAge >= currentAge && btoApplicationAge <= deathAge) {
          dp1Deductions.push({ age: btoApplicationAge, amount: btoPass1.dp1.fromOA });
        }

        // Pass 2: DP1 deduction only — get corrected OA at DP2 age
        const pass2 = buildCpfProjection({ ...cpfBaseInputs, oaDeductions: dp1Deductions });
        const oaAtDp2Age = pass2.find((r) => r.age === btoCollectionAge)?.oaBalance ?? 0;

        // Full BTO breakdown with correct OA at both DP ages
        const bto = computeBtoBreakdown(inputs, oaAtDp1Age, oaAtDp2Age);

        // Build complete deductions list: DP1, DP2, annual mortgage
        const cpfOaDeductions: { age: number; amount: number }[] = [];
        if (bto.dp1.fromOA > 0 && btoApplicationAge >= currentAge && btoApplicationAge <= deathAge) {
          cpfOaDeductions.push({ age: btoApplicationAge, amount: bto.dp1.fromOA });
        }
        if (bto.dp2.fromOA > 0 && btoCollectionAge >= currentAge && btoCollectionAge <= deathAge) {
          cpfOaDeductions.push({ age: btoCollectionAge, amount: bto.dp2.fromOA });
        }
        const annualMortgage = bto.monthlyMortgage * 12;
        if (annualMortgage > 0) {
          for (let age = btoCollectionAge; age <= bto.mortgageEndAge; age++) {
            if (age >= currentAge && age <= deathAge) {
              cpfOaDeductions.push({ age, amount: annualMortgage });
            }
          }
        }

        // Pass 3: all deductions applied — final rows
        cpfRows = buildCpfProjection({ ...cpfBaseInputs, oaDeductions: cpfOaDeductions });
      }

      const convRow = cpfRows.find((r) => r.raConversionHappened);
      const cpfLifePayoutRatio = convRow?.cpfLifePayoutRatio ?? 1;
      const cpfLifeAnnualPayout =
        cpfLifeMonthlyPayout * 12 * Math.pow(1 + CPF_FRS_INFLATION_RATE, cpfWithdrawalAge - currentAge) * cpfLifePayoutRatio;

      // Delay OA transfer until after mortgage is fully paid if that happens after cpfRetirementAge
      const oaTransferAge = btoFlatPrice > 0
        ? Math.max(cpfRetirementAge, btoCollectionAge + btoLoanTenureYears)
        : cpfRetirementAge;
      const oaBalance = cpfRows.find((r) => r.age === oaTransferAge)?.oaBalance ?? convRow?.oaBalance ?? 0;

      // Brokerage projection using acc row contributions
      const contributions = accRows.map((r) => r.invested);
      const rows = buildBrokerageProjection({
        startingCash,
        currentAge,
        workingYears,
        cpfRetirementAge,
        deathAge,
        investmentGrowthRate,
        investmentGrowthRateRetirement,
        contributions,
        oaAtRetirement: oaBalance,
        oaTransferAge,
        stopWorkingAge,
        srsWithdrawalAge,
        cpfWithdrawalAge,
        cpfLifeAnnualPayout,
        srsAnnualIncome,
        annualExpensesToday,
        extraExpensesByAge: retirementMortgageByAge,
      });

      // --- SRS pot chart data (contribution = srsTopUp for that year, null outside working years) ---
      const srsTopUpByEndAge = new Map<number, number>();
      for (let i = 0; i < workingYears; i++) {
        srsTopUpByEndAge.set(currentAge + i, accRows[i].srsTopUp);
      }

      const srsPotArr: { age: number; srs: number; contribution: number | null }[] = [];
      for (let age = currentAge; age <= srsWithdrawalAge; age++) {
        const topUp = srsTopUpByEndAge.get(age) ?? null;
        srsPotArr.push({
          age,
          srs: Math.round(srsPotByAge.get(age) ?? 0),
          contribution: topUp !== null ? Math.round(topUp) : null,
        });
      }
      for (let k = 1; k <= Math.max(0, deathAge - srsWithdrawalAge); k++) {
        srsPotArr.push({
          age: srsWithdrawalAge + k,
          srs: Math.round(Math.max(0, finalSrsPot - srsYearlyWithdrawal * k)),
          contribution: null,
        });
      }

      // --- Cash chart data ---
      const cashArr: { age: number; cash: number }[] = [];
      cashArr.push({ age: currentAge, cash: Math.round(cash) });
      let lastCash = cash;
      for (const r of accRows) {
        cashArr.push({ age: r.age + 1, cash: Math.round(Math.max(0, r.cashBalance)) });
        lastCash = Math.max(0, r.cashBalance);
      }
      for (let age = stopWorkingAge + 1; age <= deathAge; age++) {
        cashArr.push({ age, cash: Math.round(lastCash) });
      }

      // --- Net worth chart data ---
      const cpfMap = new Map<number, number>();
      cpfMap.set(currentAge, cpfOA + cpfSA + cpfMA + cpfRA);
      for (const r of cpfRows) {
        const val =
          convRow && r.age >= oaTransferAge
            ? r.totalBalance - r.oaBalance
            : r.totalBalance;
        cpfMap.set(r.age, Math.max(0, val));
      }

      const srsMap = new Map<number, number>();
      for (const pt of srsPotArr) srsMap.set(pt.age, pt.srs);

      const brokerageMap = new Map<number, number>();
      for (const r of rows) brokerageMap.set(r.age, Math.max(0, r.balance));

      const cashMap = new Map<number, number>(cashArr.map((pt) => [pt.age, pt.cash]));

      const totalYears = Math.max(0, deathAge - currentAge);
      const nwData: NetWorthPoint[] = Array.from({ length: totalYears + 1 }, (_, i) => {
        const age = currentAge + i;
        const cpf = cpfMap.get(age) ?? 0;
        const srs = srsMap.get(age) ?? 0;
        const brokerage = brokerageMap.get(age) ?? 0;
        const cashAtAge = cashMap.get(age) ?? lastCash;
        return {
          age,
          cpf: Math.round(cpf),
          srs: Math.round(srs),
          brokerage: Math.round(brokerage),
          cash: Math.round(cashAtAge),
          total: Math.round(cpf + srs + brokerage + cashAtAge),
        };
      });

      return {
        brokerageRows: rows,
        oaAtRetirement: oaBalance,
        oaTransferAge,
        srsPotData: srsPotArr,
        cashData: cashArr,
        srsPotAtWithdrawal: finalSrsPot,
        srsWithdrawal: w,
        netWorthData: nwData,
        brokerageContributions: contributions,
        cpfRows,
        cpfLifeAnnualPayout,
        allMortgagePayments,
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
      srsWithdrawalAge,
      startingCash,
      cpfOA,
      cpfSA,
      cpfMA,
      cpfRA,
      cpfLifeFrs,
      workingYears,
      seriesOverride,
      cpfLifeMonthlyPayout,
      annualExpensesToday, monthlyExpensesRetirement,
      monthlyExpensesToday,
      monthlyExpenseSeries,
      emergencyMonths,
      lumpsumExpenses,
      lumpsumInflows,
      cash,
      srsAnnualCap,
      srsAccepted,
      btoFlatPrice,
      btoApplicationAge,
      btoCollectionAge,
      btoLoanTenureYears,
      inputs,
    ]);

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

  const peakRow = brokerageRows.reduce(
    (best, r) => (r.balance > best.balance ? r : best),
    brokerageRows[0],
  );


  const runOutRow = brokerageRows.find(
    (r) => r.age > stopWorkingAge && r.balance <= 0,
  );
  const canRetire = runOutRow === undefined;

  const peakNwRow = netWorthData.reduce(
    (best, r) => (r.total > best.total ? r : best),
    netWorthData[0] ?? { age: currentAge, total: 0 },
  );

  // --- Smart Summary panel ---
  const [summaryOpen, setSummaryOpen] = useState(false);
  const verdictRowRef = useRef<HTMLDivElement>(null);
  const [summaryTargetWidth, setSummaryTargetWidth] = useState(0);
  useEffect(() => {
    if (!verdictRowRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setSummaryTargetWidth(Math.round(entries[0].contentRect.width / 2 - 8));
    });
    obs.observe(verdictRowRef.current);
    return () => obs.disconnect();
  }, []);

  const summary = useMemo(() => {
    // Average amount invested into the brokerage per working year (ignore withdrawal years).
    const positiveContribs = brokerageContributions.filter((c) => c > 0);
    const avgInvested =
      positiveContribs.length > 0
        ? positiveContribs.reduce((s, c) => s + c, 0) / positiveContribs.length
        : 0;

    // Brokerage balance left over at the end of life.
    const leftoverAtDeath = brokerageRows.length > 0 ? Math.max(0, brokerageRows[brokerageRows.length - 1].balance) : 0;

    // BTO mortgage facts.
    const hasBto = btoFlatPrice > 0;
    const mortgagePayoffAge = btoCollectionAge + btoLoanTenureYears;
    const mortgageCashTotal = allMortgagePayments.reduce((s, p) => s + p.amount, 0);
    const mortgageNeedsWithdrawal = mortgageCashTotal > 0;

    // CPF OA: does it run dry during the BTO years, or is there a balance left at transfer?
    const oaRunOutRow = hasBto
      ? cpfRows.find((r) => r.age >= btoCollectionAge && r.age <= oaTransferAge && r.oaBalance < 1)
      : undefined;
    const oaRunOutAge = oaRunOutRow?.age;

    // CPF LIFE annuity premium (RA balance converted at withdrawal age).
    const cpfLifePremium = cpfRows.find((r) => r.cpfLifeHappened)?.cpfLifePremium ?? 0;
    const cpfLifeMonthly = cpfLifeAnnualPayout / 12;

    return {
      avgInvested,
      leftoverAtDeath,
      hasBto,
      mortgagePayoffAge,
      mortgageCashTotal,
      mortgageNeedsWithdrawal,
      oaRunOutAge,
      oaLeftAtTransfer: oaAtRetirement,
      cpfLifePremium,
      cpfLifeMonthly,
    };
  }, [
    brokerageContributions,
    brokerageRows,
    btoFlatPrice,
    btoCollectionAge,
    btoLoanTenureYears,
    allMortgagePayments,
    cpfRows,
    oaTransferAge,
    oaAtRetirement,
    cpfLifeAnnualPayout,
  ]);

  const gridColor = "var(--grid-color)";
  const axisColor = "var(--axis-color)";

  // Stagger levels for networth chart reference lines to prevent label overlap
  type NwMilestoneId = "stop" | "cpfret" | "srs" | "life";
  const nwMilestones = ([
    ...(stopWorkingAge !== cpfRetirementAge ? [{ id: "stop" as NwMilestoneId, age: stopWorkingAge }] : []),
    { id: "cpfret" as NwMilestoneId, age: cpfRetirementAge },
    { id: "srs" as NwMilestoneId, age: srsWithdrawalAge },
    { id: "life" as NwMilestoneId, age: cpfWithdrawalAge },
  ] as { id: NwMilestoneId; age: number }[]).sort((a, b) => a.age - b.age);
  const nwAssignedLevels: number[] = [];
  const nwStaggerLevel: Record<NwMilestoneId, number> = { stop: 0, cpfret: 0, srs: 0, life: 0 };
  const NW_PROX_YEARS = 5;
  for (let i = 0; i < nwMilestones.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (nwMilestones[i].age - nwMilestones[j].age < NW_PROX_YEARS) used.add(nwAssignedLevels[j]);
    }
    let lvl = 0;
    while (used.has(lvl)) lvl++;
    nwAssignedLevels[i] = lvl;
    nwStaggerLevel[nwMilestones[i].id] = lvl;
  }

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Networth</h1>
        <p className="text-foreground/85 dark:text-foreground/60 text-sm mt-1">
          Net worth across CPF, SRS, and investments — age {currentAge} to {deathAge}.
        </p>
      </header>

      <div className="mb-8 flex items-start gap-2 border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300/90">
        <span className="shrink-0 mt-0.5">ℹ</span>
        <span>
          For an accurate projection, enter your financial details in{" "}
          <a href="/config" className="underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200 transition-colors">
            Config
          </a>
          . Your financial goals are unique to you!
        </span>
      </div>

      {/* Verdict text + Smart Summary slide-over */}
      <div ref={verdictRowRef} className="flex items-start mb-6">
        {/* Verdict text — expands to fill space as summary slides out */}
        <div className="flex-1 relative flex items-center justify-center">
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

          {/* Sparkles toggle button — pinned to right edge of verdict, vertically centred */}
          <button
            onClick={() => setSummaryOpen((o) => !o)}
            className="absolute right-0 top-1/2 translate-x-[20%] -translate-y-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full border border-emerald-500/40 bg-background shadow-sm hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            aria-label={summaryOpen ? "Hide smart summary" : "Show smart summary"}
            title={summaryOpen ? "Hide smart summary" : "Show smart summary"}
          >
            <Sparkles size={15} />
          </button>
        </div>

        {/* Smart Summary panel */}
        <SmartSummary
          open={summaryOpen}
          canRetire={canRetire}
          stopWorkingAge={stopWorkingAge}
          runOutAge={runOutRow?.age}
          currentAge={currentAge}
          deathAge={deathAge}
          monthlyExpensesToday={monthlyExpensesToday}
          monthlyExpensesRetirement={monthlyExpensesRetirement}
          peakBrokerageBalance={peakRow?.balance ?? 0}
          peakBrokerageAge={peakRow?.age ?? stopWorkingAge}
          oaTransferAge={oaTransferAge}
          cpfWithdrawalAge={cpfWithdrawalAge}
          data={summary}
          targetWidth={summaryTargetWidth}
        />
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
      <section className="border border-foreground/10 bg-foreground/[0.03] p-6 mb-8">
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
                label={<StaggeredLabel value={`Retire (${stopWorkingAge})`} fill="var(--chart-stop)" level={nwStaggerLevel["stop"]} />}
              />
            )}
            <ReferenceLine
              x={cpfRetirementAge}
              stroke="var(--chart-cpf-ret)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={<StaggeredLabel value={stopWorkingAge === cpfRetirementAge ? `Retire / OA→Brok (${cpfRetirementAge})` : `OA→Brok (${cpfRetirementAge})`} fill="var(--chart-cpf-ret)" level={nwStaggerLevel["cpfret"]} />}
            />
            <ReferenceLine
              x={srsWithdrawalAge}
              stroke="var(--chart-cpf-wit)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={<StaggeredLabel value={`SRS starts (${srsWithdrawalAge})`} fill="var(--chart-cpf-wit)" level={nwStaggerLevel["srs"]} />}
            />
            <ReferenceLine
              x={cpfWithdrawalAge}
              stroke="var(--chart-srs-wit)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={<StaggeredLabel value={`CPF LIFE (${cpfWithdrawalAge})`} fill="var(--chart-srs-wit)" level={nwStaggerLevel["life"]} />}
            />

            <Line type="monotone" dataKey="total" name="Total Net Worth" stroke="var(--chart-total)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="brokerage" name="Investments" stroke="var(--chart-inv)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="srs" name="SRS Pot" stroke="var(--chart-srs)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cpf" name="CPF" stroke="var(--chart-cpf)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cash" name="Cash" stroke="var(--chart-cash)" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Brokerage Chart */}
      <section className="border border-foreground/10 bg-foreground/[0.03] p-6">
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
        <div className="mt-3 flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400/90 mb-6">
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
                    label={{ value: "Retire", position: "insideTopRight", fill: "var(--chart-stop)", fontSize: 11 }}
                  />
                )}
                <ReferenceLine
                  x={cpfRetirementAge}
                  stroke="var(--chart-cpf-ret)"
                  strokeDasharray="4 4"
                  label={{
                    value: stopWorkingAge === cpfRetirementAge ? "Retire / OA Transfer" : "OA Transfer",
                    position: "insideTopLeft",
                    fill: "var(--chart-cpf-ret)",
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  x={srsWithdrawalAge}
                  stroke="var(--chart-cpf-wit)"
                  strokeDasharray="4 4"
                  label={{ value: "SRS starts", position: "insideTopRight", fill: "var(--chart-cpf-wit)", fontSize: 11 }}
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
      </section>

      {/* SRS Pot Chart */}
      <section className="border border-foreground/10 bg-foreground/[0.03] p-6 mb-8 mt-8">
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
                  label={{ value: `Stop work (${stopWorkingAge})`, position: "insideTopRight", fill: "var(--chart-stop)", fontSize: 10 }}
                />
                <ReferenceLine
                  x={srsWithdrawalAge}
                  stroke="var(--chart-cpf-wit)"
                  strokeDasharray="4 4"
                  label={{ value: `Withdrawals start (${srsWithdrawalAge})`, position: "insideTopLeft", fill: "var(--chart-cpf-wit)", fontSize: 10 }}
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
      </section>

      {/* Cash Chart */}
      <section className="border border-foreground/10 bg-foreground/[0.03] p-6 mb-8">
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
                  label={{ value: `Retire (${stopWorkingAge})`, position: "insideTopRight", fill: "var(--chart-stop)", fontSize: 10 }}
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
      </section>
    </main>
  );
}
