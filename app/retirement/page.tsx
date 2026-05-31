"use client";

import { useMemo } from "react";
import { useProfile } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { StatCard, Td, Th } from "@/app/components/ui";
import {
  buildBrokerageProjection,
  buildCpfProjection,
  calculateSrsWithdrawal,
  CPF_FRS_INFLATION_RATE,
  CPF_EMPLOYEE_RATE,
  SRS_WITHDRAWAL_YEARS,
  EXPENSES_INFLATION_RATE,
  recommendedSrsTopUp,
  SRS_ANNUAL_CAP,
} from "@/lib/tax";
import { buildAccumulation } from "@/lib/cash-flow";
import { computeMortgageCashPayments } from "@/lib/bto";

type WithdrawalRow = {
  age: number;
  yearsFromNow: number;
  annualExpenses: number;
  monthlyExpenses: number;
  cpfLifeIncome: number;
  srsIncome: number;
  shortfall: number;
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
  extraExpensesByAge?: Map<number, number>,
): WithdrawalRow[] {
  const rows: WithdrawalRow[] = [];
  for (let age = stopWorkingAge; age <= deathAge; age++) {
    const yearsFromNow = age - currentAge;
    const baseExpenses = annualExpensesToday * Math.pow(1 + EXPENSES_INFLATION_RATE, yearsFromNow);
    const annualExpenses = baseExpenses + (extraExpensesByAge?.get(age) ?? 0);
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

export default function RetirementPage() {
  const { inputs } = useProfile();
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
    salarySeries,
    startingCash,
    cpfOA,
    cpfSA,
    cpfMA,
    cpfRA,
    cpfLifeFrs,
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
    btoCollectionAge,
    btoLoanTenureYears,
  } = inputs;

  const annualExpensesToday = monthlyExpensesRetirement * 12;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);
  const seriesOverride = salarySeries.length === workingYears ? salarySeries : undefined;

  const cpfLifeAnnualPayout =
    cpfLifeMonthlyPayout * 12 * Math.pow(1 + CPF_FRS_INFLATION_RATE, cpfWithdrawalAge - currentAge);

  const mortgageCashPayments = useMemo(
    () => computeMortgageCashPayments(inputs),
    [inputs],
  );

  // Map of retirement-year ages → mortgage cash amount (for table display and brokerage drawdown)
  const retirementMortgageByAge = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of mortgageCashPayments) {
      if (p.age >= stopWorkingAge && p.age <= deathAge) map.set(p.age, p.amount);
    }
    return map;
  }, [mortgageCashPayments, stopWorkingAge, deathAge]);

  const { srsAnnualIncome, srsPotAtWithdrawal, srsWithdrawalInfo, brokerageByAge } = useMemo(() => {
    // Compute recommended SRS top-ups per year, honouring per-year accept/reject from context.
    const srsTopUps = Array.from({ length: workingYears }, (_, i) => {
      const accepted = i < srsAccepted.length ? srsAccepted[i] : true;
      if (!accepted) return 0;
      const salary = seriesOverride?.[i] ?? startingSalary * Math.pow(1 + salaryGrowthRate, i);
      const takeHome = salary * (1 - CPF_EMPLOYEE_RATE);
      return recommendedSrsTopUp(takeHome, srsAnnualCap ?? SRS_ANNUAL_CAP).topUp;
    });

    // Working-year mortgage cash as lumpsum expenses so contributions are reduced accurately
    const workingMortgageLumpsums = mortgageCashPayments
      .filter((p) => p.age >= currentAge && p.age < stopWorkingAge)
      .map((p) => ({ id: `bto-mtg-${p.age}`, age: p.age, name: "BTO Mortgage", amount: p.amount }));

    const accRows = buildAccumulation({
      currentAge,
      stopWorkingAge,
      startingSalary,
      salaryGrowthRate,
      salarySeries: seriesOverride,
      monthlyExpensesToday,
      monthlyExpenseSeries: monthlyExpenseSeries.length === workingYears ? monthlyExpenseSeries : undefined,
      emergencyMonths,
      lumpsumExpenses: [...lumpsumExpenses, ...workingMortgageLumpsums],
      lumpsumInflows,
      cashStart: cash,
      brokerageStart: startingCash,
      investmentGrowthRate,
      srsTopUps,
    });

    // Compute SRS pot from acc rows
    let srsPotRunning = 0;
    for (let i = 0; i < workingYears; i++) {
      srsPotRunning = (srsPotRunning + accRows[i].srsTopUp) * (1 + investmentGrowthRate);
    }
    const postWorkGrowYears = Math.max(0, srsWithdrawalAge - stopWorkingAge);
    for (let j = 0; j < postWorkGrowYears; j++) {
      srsPotRunning = srsPotRunning * (1 + investmentGrowthRateRetirement);
    }

    const finalSrsPot = srsPotRunning;
    const w = calculateSrsWithdrawal(finalSrsPot);
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
    const oaTransferAge = btoFlatPrice > 0
      ? Math.max(cpfRetirementAge, btoCollectionAge + btoLoanTenureYears)
      : cpfRetirementAge;
    const convRow = cpfRows.find((r) => r.raConversionHappened);
    const oaAtRetirement = cpfRows.find((r) => r.age === oaTransferAge)?.oaBalance ?? convRow?.oaBalance ?? 0;

    const contributions = accRows.map((r) => r.invested);
    const brokerageRows = buildBrokerageProjection({
      startingCash,
      currentAge,
      workingYears,
      cpfRetirementAge,
      deathAge,
      investmentGrowthRate,
      investmentGrowthRateRetirement,
      contributions,
      oaAtRetirement,
      oaTransferAge,
      stopWorkingAge,
      srsWithdrawalAge,
      cpfWithdrawalAge,
      cpfLifeAnnualPayout,
      srsAnnualIncome: annualSrs,
      annualExpensesToday,
      extraExpensesByAge: retirementMortgageByAge,
    });

    const map = new Map<number, { brokerageIncome: number; balance: number; srsReinvestment: number }>();
    for (let k = 1; k < brokerageRows.length; k++) {
      const startAge = brokerageRows[k].age - 1;
      map.set(startAge, {
        brokerageIncome: brokerageRows[k].brokerageIncome,
        balance: brokerageRows[k - 1].balance,
        srsReinvestment: brokerageRows[k].srsReinvestment,
      });
    }

    return {
      srsAnnualIncome: annualSrs,
      srsPotAtWithdrawal: finalSrsPot,
      srsWithdrawalInfo: w,
      brokerageByAge: map,
    };
  }, [
    startingSalary, salaryGrowthRate, investmentGrowthRate, investmentGrowthRateRetirement,
    workingYears, seriesOverride,
    currentAge, stopWorkingAge, cpfWithdrawalAge, cpfRetirementAge, deathAge,
    cpfOA, cpfSA, cpfMA, cpfRA, cpfLifeFrs, startingCash, srsWithdrawalAge, cpfLifeAnnualPayout,
    annualExpensesToday, monthlyExpensesRetirement,
    monthlyExpensesToday, monthlyExpenseSeries, emergencyMonths,
    lumpsumExpenses, lumpsumInflows, cash, srsAnnualCap, srsAccepted,
    mortgageCashPayments, retirementMortgageByAge,
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
        retirementMortgageByAge,
      ),
    [currentAge, stopWorkingAge, deathAge, cpfWithdrawalAge, srsWithdrawalAge, cpfLifeAnnualPayout, srsAnnualIncome, annualExpensesToday, retirementMortgageByAge],
  );

  const retirementYears = Math.max(0, deathAge - stopWorkingAge);
  const totalNeeded = rows.reduce((s, r) => s + r.annualExpenses, 0);

  return (
    <main className="px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Retirement Phase
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Inflation-adjusted living expenses from retirement (age{" "}
          {stopWorkingAge}) to end of plan (age {deathAge}) — {retirementYears}{" "}
          years.
        </p>
      </header>

      {/* Hero + SRS side-by-side */}
      <section className="flex flex-col md:flex-row mb-8 border border-foreground/10 overflow-hidden">
        {/* Left half: total retirement spend */}
        <div className="flex-1 flex flex-col justify-center px-8 py-10 border-b md:border-b-0 md:border-r border-foreground/10">
          <p className="text-xs uppercase tracking-widest text-foreground/40 mb-3">
            Total retirement sum requirement
          </p>
          <div className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-emerald-400 leading-none">
            {fmtMoney(totalNeeded)}
          </div>
          <p className="text-foreground/50 text-sm mt-4">
            age {stopWorkingAge}–{deathAge} · {retirementYears} years
          </p>
        </div>

        {/* Right half: SRS withdrawal */}
        <div className="md:w-1/2 shrink-0 p-6 bg-emerald-500/[0.03]">
          <h2 className="font-semibold mb-0.5">SRS Withdrawal</h2>
          <p className="text-foreground/60 text-xs mb-4">
            Drawn down over 10 years from age {srsWithdrawalAge}. Only 50% of each withdrawal is taxable.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={`SRS pot at age ${srsWithdrawalAge}`}
              value={fmtMoney(srsPotAtWithdrawal)}
              accent="emerald"
            />
            <StatCard
              label="Yearly withdrawal"
              value={fmtMoney(srsWithdrawalInfo.yearlyWithdrawal)}
              sub="× 10 years"
            />
            <StatCard
              label="Tax per year"
              value={fmtMoney(srsWithdrawalInfo.taxPerYear)}
              sub={`taxable: ${fmtMoney(srsWithdrawalInfo.taxablePerYear)}/yr`}
            />
            <StatCard
              label="Total from SRS after tax"
              value={fmtMoney(srsWithdrawalInfo.netFromSrs)}
              sub={`total tax: ${fmtMoney(srsWithdrawalInfo.totalTax)}`}
            />
            <StatCard
              label="Yearly after-tax withdrawal"
              value={fmtMoney(srsWithdrawalInfo.yearlyWithdrawal - srsWithdrawalInfo.taxPerYear)}
              accent="emerald"
            />
          </div>
        </div>
      </section>

      <section className="border border-foreground/10 bg-foreground/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Annual expenses</h2>
          <span className="text-xs text-foreground/60">
            S${monthlyExpensesRetirement.toLocaleString("en-SG")}/mo today &rarr; inflated at{" "}
            {EXPENSES_INFLATION_RATE * 100}% p.a. for {Math.max(0, stopWorkingAge - currentAge)}+ years
          </span>
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
                <Th>Withdrawal from investments</Th>
                <Th>Investments balance</Th>
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
                const mortgageCash = retirementMortgageByAge.get(r.age) ?? 0;
                return (
                  <tr
                    key={r.age}
                    className={`border-b border-foreground/5 ${mortgageCash > 0 ? "bg-rose-500/[0.04]" : "hover:bg-foreground/[0.04]"}`}
                  >
                    <Td>{r.age}</Td>
                    <Td className="text-foreground/60">+{r.yearsFromNow}</Td>
                    <Td>{fmtMoney(r.monthlyExpenses)}</Td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div className="flex flex-col items-start leading-tight gap-0.5">
                        <span>{fmtMoney(r.annualExpenses)}</span>
                        {mortgageCash > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/25 text-rose-300 font-sans whitespace-nowrap">
                            BTO Mortgage +{fmtMoney(mortgageCash)}
                          </span>
                        )}
                      </div>
                    </td>
                    <Td className={r.cpfLifeIncome > 0 ? "text-orange-400" : "text-foreground/30"}>
                      {r.cpfLifeIncome > 0 ? fmtMoney(r.cpfLifeIncome) : "—"}
                    </Td>
                    <Td className={r.srsIncome > 0 ? "text-emerald-400" : "text-foreground/30"}>
                      {r.srsIncome > 0 ? fmtMoney(r.srsIncome) : "—"}
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
