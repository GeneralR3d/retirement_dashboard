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
import type { ProfileInputs } from "@/lib/profile-context";

export type NetWorthPoint = {
  age: number;
  cpf: number;
  srs: number;
  brokerage: number;
  cash: number;
  total: number;
};

export type ProjectionSummary = {
  avgInvested: number;
  leftoverAtDeath: number;
  hasBto: boolean;
  mortgagePayoffAge: number;
  mortgageCashTotal: number;
  mortgageNeedsWithdrawal: boolean;
  oaRunOutAge: number | undefined;
  oaLeftAtTransfer: number;
  cpfLifePremium: number;
  cpfLifeMonthly: number;
};

/**
 * Full net-worth projection shared by the Networth page and the Calculator
 * "At a glance" panel. Pure function of the profile inputs.
 */
export function buildFullProjection(inputs: ProfileInputs) {
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

  // Compute recommended SRS top-ups per year, honouring per-year accept/reject.
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
  const brokerageRows = buildBrokerageProjection({
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

  const srsPotData: { age: number; srs: number; contribution: number | null }[] = [];
  for (let age = currentAge; age <= srsWithdrawalAge; age++) {
    const topUp = srsTopUpByEndAge.get(age) ?? null;
    srsPotData.push({
      age,
      srs: Math.round(srsPotByAge.get(age) ?? 0),
      contribution: topUp !== null ? Math.round(topUp) : null,
    });
  }
  for (let k = 1; k <= Math.max(0, deathAge - srsWithdrawalAge); k++) {
    srsPotData.push({
      age: srsWithdrawalAge + k,
      srs: Math.round(Math.max(0, finalSrsPot - srsYearlyWithdrawal * k)),
      contribution: null,
    });
  }

  // --- Cash chart data ---
  const cashData: { age: number; cash: number }[] = [];
  cashData.push({ age: currentAge, cash: Math.round(cash) });
  let lastCash = cash;
  for (const r of accRows) {
    cashData.push({ age: r.age + 1, cash: Math.round(Math.max(0, r.cashBalance)) });
    lastCash = Math.max(0, r.cashBalance);
  }
  for (let age = stopWorkingAge + 1; age <= deathAge; age++) {
    cashData.push({ age, cash: Math.round(lastCash) });
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
  for (const pt of srsPotData) srsMap.set(pt.age, pt.srs);

  const brokerageMap = new Map<number, number>();
  for (const r of brokerageRows) brokerageMap.set(r.age, Math.max(0, r.balance));

  const cashMap = new Map<number, number>(cashData.map((pt) => [pt.age, pt.cash]));

  const totalYears = Math.max(0, deathAge - currentAge);
  const netWorthData: NetWorthPoint[] = Array.from({ length: totalYears + 1 }, (_, i) => {
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

  // --- Derived verdict + summary facts ---
  const peakRow = brokerageRows.reduce(
    (best, r) => (r.balance > best.balance ? r : best),
    brokerageRows[0],
  );
  const retirementBrokerageBalance =
    brokerageRows.find((r) => r.age === stopWorkingAge)?.balance ?? 0;
  const runOutRow = brokerageRows.find(
    (r) => r.age > stopWorkingAge && r.balance <= 0,
  );
  const canRetire = runOutRow === undefined;
  const peakNwRow = netWorthData.reduce(
    (best, r) => (r.total > best.total ? r : best),
    netWorthData[0] ?? { age: currentAge, total: 0, cpf: 0, srs: 0, brokerage: 0, cash: 0 },
  );

  // Average amount invested into the brokerage per working year (ignore withdrawal years).
  const positiveContribs = contributions.filter((c) => c > 0);
  const avgInvested =
    positiveContribs.length > 0
      ? positiveContribs.reduce((s, c) => s + c, 0) / positiveContribs.length
      : 0;

  const leftoverAtDeath =
    brokerageRows.length > 0 ? Math.max(0, brokerageRows[brokerageRows.length - 1].balance) : 0;

  const hasBto = btoFlatPrice > 0;
  const mortgagePayoffAge = btoCollectionAge + btoLoanTenureYears;
  const mortgageCashTotal = allMortgagePayments.reduce((s, p) => s + p.amount, 0);
  const mortgageNeedsWithdrawal = mortgageCashTotal > 0;

  const oaRunOutRow = hasBto
    ? cpfRows.find((r) => r.age >= btoCollectionAge && r.age <= oaTransferAge && r.oaBalance < 1)
    : undefined;

  const cpfLifePremium = cpfRows.find((r) => r.cpfLifeHappened)?.cpfLifePremium ?? 0;

  const summary: ProjectionSummary = {
    avgInvested,
    leftoverAtDeath,
    hasBto,
    mortgagePayoffAge,
    mortgageCashTotal,
    mortgageNeedsWithdrawal,
    oaRunOutAge: oaRunOutRow?.age,
    oaLeftAtTransfer: oaBalance,
    cpfLifePremium,
    cpfLifeMonthly: cpfLifeAnnualPayout / 12,
  };

  return {
    brokerageRows,
    oaAtRetirement: oaBalance,
    oaTransferAge,
    srsPotData,
    cashData,
    srsPotAtWithdrawal: finalSrsPot,
    srsWithdrawal: w,
    netWorthData,
    brokerageContributions: contributions,
    cpfRows,
    cpfLifeAnnualPayout,
    allMortgagePayments,
    peakRow,
    retirementBrokerageBalance,
    runOutRow,
    canRetire,
    peakNwRow,
    summary,
  };
}
