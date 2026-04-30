"use client";

import { useMemo } from "react";
import { useProfile } from "@/lib/profile-context";
import { useSrsToggle } from "@/lib/srs-toggle-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Td, Th } from "@/app/components/ui";
import {
  buildBrokerageProjection,
  buildCpfProjection,
  buildProjection,
  calculateSrsWithdrawal,
  CPF_FRS_INFLATION_RATE,
  SRS_WITHDRAWAL_YEARS,
  EXPENSES_INFLATION_RATE,
} from "@/lib/tax";

type WithdrawalRow = {
  age: number;
  yearsFromNow: number;
  annualExpenses: number;
  monthlyExpenses: number;
  cpfLifeIncome: number;
  srsIncome: number;
  shortfall: number; // expenses - cpfLife - srsIncome (before brokerage)
};

function buildWithdrawalRows(
  currentAge: number,
  stopWorkingAge: number,
  deathAge: number,
  cpfWithdrawalAge: number,
  srsWithdrawalAge: number,
  cpfLifeAnnualPayout: number,
  srsAnnualIncome: number,
  annualExpensesToday: number,
): WithdrawalRow[] {
  const rows: WithdrawalRow[] = [];
  for (let age = stopWorkingAge; age <= deathAge; age++) {
    const yearsFromNow = age - currentAge;
    const annualExpenses = annualExpensesToday * Math.pow(1 + EXPENSES_INFLATION_RATE, yearsFromNow);
    const cpfLifeIncome = age >= cpfWithdrawalAge ? cpfLifeAnnualPayout : 0;
    const srsIncome = age >= srsWithdrawalAge ? srsAnnualIncome : 0;
    const shortfall = annualExpenses - cpfLifeIncome - srsIncome;
    rows.push({
      age,
      yearsFromNow,
      annualExpenses,
      monthlyExpenses: annualExpenses / 12,
      cpfLifeIncome,
      srsIncome,
      shortfall,
    });
  }
  return rows;
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

export default function WithdrawalsPage() {
  const { inputs } = useProfile();
  const { srsEnabled } = useSrsToggle();
  const {
    currentAge,
    stopWorkingAge,
    deathAge,
    cpfLifeMonthlyPayout,
    cpfWithdrawalAge,
    srsWithdrawalAge,
    cpfRetirementAge,
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    investmentGrowthRateRetirement,
    livingExpensePct,
    salarySeries,
    startingCash,
    cpfOA,
    cpfSA,
    cpfMA,
    cpfRA,
    cpfLifeFrs,
    monthlyExpensesToday,
  } = inputs;

  const annualExpensesToday = monthlyExpensesToday * 12;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);
  const srsYears = Math.max(0, srsWithdrawalAge - currentAge);
  const srsWorkingYears = Math.min(srsYears, workingYears);
  const seriesOverride = salarySeries.length === workingYears ? salarySeries : undefined;

  const cpfLifeAnnualPayout =
    cpfLifeMonthlyPayout * 12 * Math.pow(1 + CPF_FRS_INFLATION_RATE, cpfWithdrawalAge - currentAge);

  const { srsAnnualIncome, brokerageByAge } = useMemo(() => {
    const srsRows = buildProjection({
      startingSalary,
      salaryGrowthRate,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      livingExpensePct,
      years: srsYears,
      workingYears: srsWorkingYears,
      salarySeries: seriesOverride,
    });
    const srsFinal = srsRows[srsRows.length - 1];
    const w = calculateSrsWithdrawal(srsFinal?.srsPot ?? 0);
    const annualSrs = w.netFromSrs / SRS_WITHDRAWAL_YEARS;

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
    const oaAtRetirement = cpfRows.find((r) => r.raConversionHappened)?.oaBalance ?? 0;

    // Re-build srsRows with full workingYears for brokerage contributions
    const fullSrsRows = buildProjection({
      startingSalary,
      salaryGrowthRate,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      livingExpensePct,
      years: Math.max(workingYears, srsYears),
      workingYears,
      salarySeries: seriesOverride,
    });

    const brokerageRows = buildBrokerageProjection({
      startingCash,
      currentAge,
      workingYears,
      cpfRetirementAge,
      deathAge,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      srsRows: fullSrsRows,
      oaAtRetirement,
      stopWorkingAge,
      srsWithdrawalAge,
      cpfWithdrawalAge,
      cpfLifeAnnualPayout,
      srsAnnualIncome: srsEnabled ? annualSrs : 0,
      srsEnabled,
      annualExpensesToday,
    });

    // Map: startAge → row data
    // result[0] = initial (age=currentAge), result[k] covers year starting at age currentAge+k-1
    const map = new Map<number, { brokerageIncome: number; balance: number; srsReinvestment: number }>();
    for (let k = 1; k < brokerageRows.length; k++) {
      const startAge = brokerageRows[k].age - 1;
      map.set(startAge, {
        brokerageIncome: brokerageRows[k].brokerageIncome,
        balance: brokerageRows[k].balance,
        srsReinvestment: brokerageRows[k].srsReinvestment,
      });
    }

    return { srsAnnualIncome: srsEnabled ? annualSrs : 0, brokerageByAge: map };
  }, [
    startingSalary, salaryGrowthRate, investmentGrowthRate, investmentGrowthRateRetirement,
    livingExpensePct, srsYears, srsWorkingYears, workingYears, seriesOverride,
    currentAge, stopWorkingAge, cpfWithdrawalAge, cpfRetirementAge, deathAge,
    cpfOA, cpfSA, cpfMA, cpfRA, cpfLifeFrs, startingCash, srsWithdrawalAge, cpfLifeAnnualPayout,
    srsEnabled, annualExpensesToday,
  ]);

  const rows = useMemo(
    () =>
      buildWithdrawalRows(
        currentAge,
        stopWorkingAge,
        deathAge,
        cpfWithdrawalAge,
        srsWithdrawalAge,
        cpfLifeAnnualPayout,
        srsAnnualIncome,
        annualExpensesToday,
      ),
    [currentAge, stopWorkingAge, deathAge, cpfWithdrawalAge, srsWithdrawalAge, cpfLifeAnnualPayout, srsAnnualIncome, annualExpensesToday],
  );

  const retirementYears = Math.max(0, deathAge - stopWorkingAge);
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const totalNeeded = rows.reduce((s, r) => s + r.annualExpenses, 0);
  const avgAnnual = retirementYears > 0 ? totalNeeded / retirementYears : 0;

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-foreground/40 mb-1">
          Base: S${monthlyExpensesToday.toLocaleString("en-SG")}/mo (S$
          {annualExpensesToday.toLocaleString("en-SG")}/yr) in today&apos;s money
          &middot; Inflation {EXPENSES_INFLATION_RATE * 100}% p.a. &middot; Expenses
          grown from current age ({currentAge}) to each retirement year
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Retirement Withdrawals
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Inflation-adjusted living expenses from retirement (age{" "}
          {stopWorkingAge}) to end of plan (age {deathAge}) — {retirementYears}{" "}
          years.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="First year expenses"
          value={fmtMoney(firstRow?.annualExpenses ?? 0)}
          sub={`${fmtMoney((firstRow?.monthlyExpenses ?? 0))}/mo at age ${stopWorkingAge}`}
        />
        <StatCard
          label="Last year expenses"
          value={fmtMoney(lastRow?.annualExpenses ?? 0)}
          sub={`${fmtMoney((lastRow?.monthlyExpenses ?? 0))}/mo at age ${deathAge}`}
        />
        <StatCard
          label="Average annual spend"
          value={fmtMoney(avgAnnual)}
          sub={`over ${retirementYears} years`}
        />
        <StatCard
          label="Total retirement spend"
          value={fmtMoney(totalNeeded)}
          sub={`age ${stopWorkingAge}–${deathAge}`}
          accent="emerald"
        />
      </section>

      <section className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Annual expenses</h2>
          <div className="flex items-center gap-4">
            <SrsToggleSwitch />
            <span className="text-xs text-foreground/60">
              S${monthlyExpensesToday.toLocaleString("en-SG")}/mo today &rarr; inflated at{" "}
              {EXPENSES_INFLATION_RATE * 100}% p.a. for {Math.max(0, stopWorkingAge - currentAge)}+ years
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-foreground/60 border-b border-foreground/10">
                <Th>Age</Th>
                <Th>Years from now</Th>
                <Th>Monthly expenses</Th>
                <Th>Annual expenses</Th>
                <Th>CPF LIFE income</Th>
                <Th>SRS income</Th>
                <Th>Brokerage income</Th>
                <Th>Brokerage balance</Th>
                <Th>Shortfall</Th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => {
                const brok = brokerageByAge.get(r.age);
                const brokerageIncome = brok?.brokerageIncome ?? 0;
                const brokerageBalance = brok?.balance ?? 0;
                const srsReinvestment = brok?.srsReinvestment ?? 0;
                const residual = r.shortfall - brokerageIncome;
                return (
                  <tr
                    key={r.age}
                    className="border-b border-foreground/5 hover:bg-foreground/[0.04]"
                  >
                    <Td>{r.age}</Td>
                    <Td className="text-foreground/60">+{r.yearsFromNow}</Td>
                    <Td>{fmtMoney(r.monthlyExpenses)}</Td>
                    <Td>{fmtMoney(r.annualExpenses)}</Td>
                    <Td className={r.cpfLifeIncome > 0 ? "text-orange-400" : "text-foreground/30"}>
                      {r.cpfLifeIncome > 0 ? fmtMoney(r.cpfLifeIncome) : "—"}
                    </Td>
                    <Td className={r.srsIncome > 0 && srsEnabled ? "text-emerald-400" : "text-foreground/30"}>
                      {r.srsIncome > 0 && srsEnabled ? fmtMoney(r.srsIncome) : "—"}
                    </Td>
                    <Td className={
                      brokerageIncome > 0 ? "text-sky-400"
                      : srsReinvestment > 0 ? "text-violet-400"
                      : "text-foreground/30"
                    }>
                      {brokerageIncome > 0
                        ? fmtMoney(brokerageIncome)
                        : srsReinvestment > 0
                        ? `+${fmtMoney(srsReinvestment)}`
                        : "—"}
                    </Td>
                    <Td className={brokerageBalance > 0 ? "text-foreground/80" : "text-foreground/30"}>
                      {brokerageBalance > 0 ? fmtMoney(brokerageBalance) : "—"}
                    </Td>
                    <Td className={residual <= 0 ? "text-emerald-400" : "text-red-400"}>
                      {residual <= 0 ? `+${fmtMoney(-residual)}` : `-${fmtMoney(residual)}`}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
