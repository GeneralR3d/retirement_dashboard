export const SRS_ANNUAL_CAP = 15300;
export const CPF_EMPLOYEE_RATE = 0.2; // fixed statutory rate for employees under 55

export const MONTHLY_EXPENSES_TODAY = 4000;
export const ANNUAL_EXPENSES_TODAY = MONTHLY_EXPENSES_TODAY * 12;
export const EXPENSES_INFLATION_RATE = 0.02;

// Allocation ratios from CPF Board table (ratio of total employee contribution).
// Rows are inclusive upper-age bounds; the last entry covers all remaining ages.
// TODO: add rows for Above 55–60, Above 60–65, Above 65 once the full table is available.
const CPF_ALLOCATION_BANDS: { maxAge: number; oa: number; sa: number; ma: number }[] = [
  { maxAge: 35, oa: 0.6217, sa: 0.1621, ma: 0.2162 },
  { maxAge: 45, oa: 0.5677, sa: 0.1891, ma: 0.2432 },
  { maxAge: 50, oa: 0.5136, sa: 0.2162, ma: 0.2702 },
  { maxAge: 55, oa: 0.4055, sa: 0.3108, ma: 0.2837 },
];

export type CpfAllocation = { oa: number; sa: number; ma: number };

export function allocateCpfContribution(age: number, contribution: number): CpfAllocation {
  const band = CPF_ALLOCATION_BANDS.find((b) => age <= b.maxAge);
  if (!band || contribution <= 0) return { oa: 0, sa: 0, ma: 0 };
  return {
    oa: contribution * band.oa,
    sa: contribution * band.sa,
    ma: contribution * band.ma,
  };
}

const TAX_BRACKETS: { limit: number; base: number; rate: number }[] = [
  { limit: 20000, base: 0, rate: 0 },
  { limit: 30000, base: 0, rate: 0.02 },
  { limit: 40000, base: 200, rate: 0.035 },
  { limit: 80000, base: 550, rate: 0.07 },
  { limit: 120000, base: 3350, rate: 0.115 },
  { limit: 160000, base: 7950, rate: 0.15 },
  { limit: 200000, base: 13950, rate: 0.18 },
  { limit: 240000, base: 21150, rate: 0.19 },
  { limit: 280000, base: 28750, rate: 0.195 },
  { limit: 320000, base: 36550, rate: 0.2 },
  { limit: 500000, base: 44550, rate: 0.22 },
  { limit: 1000000, base: 84150, rate: 0.23 },
  { limit: Infinity, base: 199150, rate: 0.24 },
];

export function calculateTax(income: number): number {
  if (income <= 0) return 0;
  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i];
    const prevLimit = i === 0 ? 0 : TAX_BRACKETS[i - 1].limit;
    if (income <= bracket.limit) {
      return bracket.base + (income - prevLimit) * bracket.rate;
    }
  }
  return 0;
}

export type SrsTopUpResult = { topUp: number; taxSavings: number };

// Minimum SRS top-up needed to drop `income` into the next-lower tax bracket.
// `income` is chargeable income (e.g. takeHome), not gross salary.
// Returns topUp=0 if already in the 0% bracket, or if the required top-up exceeds maxTopUp.
export function recommendedSrsTopUp(income: number, maxTopUp: number): SrsTopUpResult {
  if (income <= 0 || maxTopUp <= 0) return { topUp: 0, taxSavings: 0 };
  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const bracket = TAX_BRACKETS[i];
    if (income <= bracket.limit) {
      if (bracket.rate === 0) return { topUp: 0, taxSavings: 0 };
      const prevLimit = i === 0 ? 0 : TAX_BRACKETS[i - 1].limit;
      const needed = income - prevLimit;
      if (needed > maxTopUp) return { topUp: 0, taxSavings: 0 };
      const taxSavings = calculateTax(income) - calculateTax(income - needed);
      return { topUp: needed, taxSavings };
    }
  }
  return { topUp: 0, taxSavings: 0 };
}

export type YearRow = {
  year: number;
  salary: number;
  cpfContribution: number;
  takeHome: number;
  livingExpenses: number;
  srsContribution: number;
  taxNoSrs: number;
  taxWithSrs: number;
  taxSavings: number;
  investedNoSrs: number;
  investedWithSrs: number;
  potNoSrs: number;
  potWithSrs: number;
  srsPot: number;
  brokeragePotWithSrs: number;
  brokerageWithSrs: number;
};

export type ProjectionInputs = {
  startingSalary: number;
  salaryGrowthRate: number; // decimal, e.g. 0.04
  investmentGrowthRate: number; // decimal, e.g. 0.07
  investmentGrowthRateRetirement?: number; // rate applied after workingYears; defaults to investmentGrowthRate
  livingExpensePct: number; // decimal of pre-tax salary
  years: number;
  workingYears?: number; // years with active salary; salary = 0 beyond this
  srsCap?: number;
  salarySeries?: number[]; // per-year gross salary; overrides formula when provided
};

export function buildProjection(inputs: ProjectionInputs): YearRow[] {
  const {
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    investmentGrowthRateRetirement = investmentGrowthRate,
    livingExpensePct,
    years,
    workingYears = years,
    srsCap = SRS_ANNUAL_CAP,
    salarySeries,
  } = inputs;

  const rows: YearRow[] = [];
  let potNoSrs = 0;
  let srsPot = 0;
  let brokeragePotWithSrs = 0;

  for (let i = 0; i < years; i++) {
    const salary = i < workingYears
      ? (salarySeries?.[i] ?? startingSalary * Math.pow(1 + salaryGrowthRate, i))
      : 0;
    const cpfContribution = salary * CPF_EMPLOYEE_RATE;
    const takeHome = salary - cpfContribution; // cash available after CPF
    const livingExpenses = takeHome * livingExpensePct;

    // SRS is funded from take-home cash, capped at the statutory limit.
    const srsContribution = Math.min(srsCap, Math.max(0, takeHome));

    const taxNoSrs = calculateTax(takeHome);
    const taxWithSrs = calculateTax(Math.max(0, takeHome - srsContribution));
    const taxSavings = taxNoSrs - taxWithSrs;

    // Without SRS: invest whatever's left from take-home after tax + living expenses.
    const investedNoSrs = Math.max(0, takeHome - taxNoSrs - livingExpenses);

    // With SRS: SRS pot gets srsContribution, brokerage gets the rest of
    // take-home after SRS, tax, and living expenses.
    const brokerageWithSrs = Math.max(
      0,
      takeHome - srsContribution - taxWithSrs - livingExpenses,
    );
    const investedWithSrs = srsContribution + brokerageWithSrs;

    const growthRate = i < workingYears ? investmentGrowthRate : investmentGrowthRateRetirement;
    potNoSrs = (potNoSrs + investedNoSrs) * (1 + growthRate);
    srsPot = (srsPot + srsContribution) * (1 + growthRate);
    brokeragePotWithSrs =
      (brokeragePotWithSrs + brokerageWithSrs) * (1 + growthRate);
    const potWithSrs = srsPot + brokeragePotWithSrs;

    rows.push({
      year: i + 1,
      salary,
      cpfContribution,
      takeHome,
      livingExpenses,
      srsContribution,
      taxNoSrs,
      taxWithSrs,
      taxSavings,
      investedNoSrs,
      investedWithSrs,
      potNoSrs,
      potWithSrs,
      srsPot,
      brokeragePotWithSrs,
      brokerageWithSrs,
    });
  }

  return rows;
}

export const CPF_OA_RATE = 0.025;
export const CPF_SA_RATE = 0.04;
export const CPF_MA_RATE = 0.04;
export const CPF_RA_RATE = 0.04;
export const CPF_TOTAL_CONTRIBUTION_RATE = 0.37;
export const CPF_FRS_INFLATION_RATE = 0.02;

export type CpfYearRow = {
  year: number;
  age: number;
  salary: number;
  totalContribution: number;
  oaContribution: number;
  saContribution: number;
  maContribution: number;
  oaBalance: number;
  saBalance: number;
  maBalance: number;
  raBalance: number;
  totalBalance: number;
  saBalanceAtConversion: number; // SA balance just before zeroing on raConversionHappened row, 0 otherwise
  raConversionHappened: boolean;
  cpfLifeHappened: boolean;
  cpfLifePremium: number; // RA balance used to buy CPF LIFE annuity (non-zero only on cpfLifeHappened row)
  oaDeducted: number; // Total OA withdrawn for BTO downpayments and mortgage this year
};

export type CpfProjectionInputs = {
  currentAge: number;
  stopWorkingAge: number;
  cpfWithdrawalAge: number;
  cpfRetirementAge: number;
  startingSalary: number;
  salaryGrowthRate: number;
  cpfOA: number;
  cpfSA: number;
  cpfMA: number;
  cpfRA: number;
  cpfLifeFrs: number;
  endAge?: number;
  salarySeries?: number[];
  oaDeductions?: { age: number; amount: number }[];
};

export function buildCpfProjection(inputs: CpfProjectionInputs): CpfYearRow[] {
  const {
    currentAge,
    stopWorkingAge,
    cpfWithdrawalAge,
    cpfRetirementAge,
    startingSalary,
    salaryGrowthRate,
    cpfOA: initOA,
    cpfSA: initSA,
    cpfMA: initMA,
    cpfRA: initRA,
    cpfLifeFrs,
    salarySeries,
  } = inputs;

  const years = Math.max(0, (inputs.endAge ?? cpfWithdrawalAge) - currentAge);
  const workingYears = Math.min(years, Math.max(0, stopWorkingAge - currentAge));

  // FRS target at cpfRetirementAge, inflated at CPF_FRS_INFLATION_RATE
  const raTarget = cpfLifeFrs * Math.pow(1 + CPF_FRS_INFLATION_RATE, Math.max(0, cpfRetirementAge - currentAge));

  // Build a lookup: age → total OA to deduct that year
  const oaDeductionByAge = new Map<number, number>();
  for (const d of inputs.oaDeductions ?? []) {
    oaDeductionByAge.set(d.age, (oaDeductionByAge.get(d.age) ?? 0) + d.amount);
  }

  let oaBalance = initOA;
  let saBalance = initSA;
  let maBalance = initMA;
  let raBalance = initRA;
  let converted = false;
  let cpfLifePurchased = false;

  const rows: CpfYearRow[] = [];

  for (let i = 0; i < years; i++) {
    const salary = i < workingYears
      ? (salarySeries?.[i] ?? startingSalary * Math.pow(1 + salaryGrowthRate, i))
      : 0;
    const totalContribution = salary * CPF_TOTAL_CONTRIBUTION_RATE;
    const alloc = allocateCpfContribution(currentAge + i, totalContribution);

    // After SA→RA conversion, redirect any would-be SA contributions to OA
    const saContrib = converted ? 0 : alloc.sa;
    const oaContrib = alloc.oa + (converted ? alloc.sa : 0);

    oaBalance = (oaBalance + oaContrib) * (1 + CPF_OA_RATE);
    saBalance = (saBalance + saContrib) * (1 + CPF_SA_RATE);
    maBalance = (maBalance + alloc.ma) * (1 + CPF_MA_RATE);
    raBalance = raBalance * (1 + CPF_RA_RATE);

    const age = currentAge + i + 1;

    // Apply OA deductions (BTO downpayments and mortgage) before SA→RA conversion
    const rawDeduction = oaDeductionByAge.get(age) ?? 0;
    const actualDeducted = Math.min(rawDeduction, Math.max(0, oaBalance));
    oaBalance -= actualDeducted;

    let raConversionHappened = false;
    let saBalanceAtConversion = 0;

    // SA→RA conversion at cpfRetirementAge: done once, after year-end balances are computed
    if (!converted && age === cpfRetirementAge) {
      converted = true;
      raConversionHappened = true;
      saBalanceAtConversion = saBalance;
      if (saBalance >= raTarget) {
        oaBalance += saBalance - raTarget;
        raBalance += raTarget;
      } else {
        const deficit = raTarget - saBalance;
        oaBalance = Math.max(0, oaBalance - deficit);
        raBalance += raTarget;
      }
      saBalance = 0;
    }

    // CPF LIFE: at cpfWithdrawalAge, RA is used entirely to buy the annuity
    let cpfLifeHappened = false;
    let cpfLifePremium = 0;
    if (!cpfLifePurchased && age === cpfWithdrawalAge) {
      cpfLifePurchased = true;
      cpfLifeHappened = true;
      cpfLifePremium = raBalance;
      raBalance = 0;
    }

    rows.push({
      year: i + 1,
      age,
      salary,
      totalContribution,
      oaContribution: oaContrib,
      saContribution: saContrib,
      maContribution: alloc.ma,
      oaBalance,
      saBalance,
      maBalance,
      raBalance,
      totalBalance: oaBalance + saBalance + maBalance + raBalance,
      saBalanceAtConversion,
      raConversionHappened,
      cpfLifeHappened,
      cpfLifePremium,
      oaDeducted: actualDeducted,
    });
  }

  return rows;
}

export type BrokerageRow = {
  age: number; // end-of-year age
  balance: number;
  brokerageIncome: number;   // withdrawal taken during this year
  srsReinvestment: number;   // surplus from SRS/CPF LIFE reinvested this year
};

export function buildBrokerageProjection(inputs: {
  startingCash: number;
  currentAge: number;
  workingYears: number;
  cpfRetirementAge: number;
  deathAge: number;
  investmentGrowthRate: number;
  investmentGrowthRateRetirement: number;
  contributions: number[]; // brokerage contribution per working year (SRS already deducted)
  oaAtRetirement: number;
  // Withdrawal phase: from stopWorkingAge (inclusive) until srsWithdrawalAge (exclusive)
  stopWorkingAge: number;
  srsWithdrawalAge: number;
  cpfWithdrawalAge: number;
  cpfLifeAnnualPayout: number; // already inflated to cpfWithdrawalAge, fixed thereafter
  srsAnnualIncome: number;     // net annual SRS income from srsWithdrawalAge onwards
  annualExpensesToday?: number; // inflation base; defaults to ANNUAL_EXPENSES_TODAY
  extraExpensesByAge?: Map<number, number>; // one-off extra expenses per start-of-year age
  // Age at which OA balance transfers to brokerage. Defaults to cpfRetirementAge; delayed when
  // BTO mortgage finishes after cpfRetirementAge so OA keeps servicing the loan.
  oaTransferAge?: number;
}): BrokerageRow[] {
  const {
    startingCash, currentAge, workingYears, cpfRetirementAge, deathAge,
    investmentGrowthRate, investmentGrowthRateRetirement, contributions, oaAtRetirement,
    stopWorkingAge, srsWithdrawalAge, cpfWithdrawalAge, cpfLifeAnnualPayout, srsAnnualIncome,
    annualExpensesToday = ANNUAL_EXPENSES_TODAY,
    extraExpensesByAge,
    oaTransferAge = cpfRetirementAge,
  } = inputs;

  const totalYears = Math.max(0, deathAge - currentAge);
  const result: BrokerageRow[] = [{ age: currentAge, balance: startingCash, brokerageIncome: 0, srsReinvestment: 0 }];
  let balance = startingCash;

  for (let i = 0; i < totalYears; i++) {
    const startAge = currentAge + i;
    const endAge = startAge + 1;

    const contribution = i < workingYears ? (contributions[i] ?? 0) : 0;
    const oaInjection = endAge === oaTransferAge ? oaAtRetirement : 0;

    let brokerageIncome = 0;
    let srsReinvestment = 0;

    // Phase 1 — drawdown: withdraw shortfall while waiting for SRS
    if (startAge >= stopWorkingAge && startAge < srsWithdrawalAge) {
      const baseExpenses = annualExpensesToday * Math.pow(1 + EXPENSES_INFLATION_RATE, i);
      const expenses = baseExpenses + (extraExpensesByAge?.get(startAge) ?? 0);
      const cpfLife = startAge >= cpfWithdrawalAge ? cpfLifeAnnualPayout : 0;
      const shortfall = Math.max(0, expenses - cpfLife);
      brokerageIncome = Math.min(shortfall, Math.max(0, balance + oaInjection));
    }

    // Phase 2 — SRS active: cover any remaining shortfall from brokerage, or reinvest surplus
    if (startAge >= srsWithdrawalAge) {
      const baseExpenses = annualExpensesToday * Math.pow(1 + EXPENSES_INFLATION_RATE, i);
      const expenses = baseExpenses + (extraExpensesByAge?.get(startAge) ?? 0);
      const cpfLife = startAge >= cpfWithdrawalAge ? cpfLifeAnnualPayout : 0;
      const net = cpfLife + srsAnnualIncome - expenses;
      if (net >= 0) {
        srsReinvestment = net;
      } else {
        brokerageIncome = Math.min(-net, Math.max(0, balance + oaInjection));
      }
    }

    const growthRate = i < workingYears ? investmentGrowthRate : investmentGrowthRateRetirement;
    balance = (balance + contribution + oaInjection - brokerageIncome + srsReinvestment) * (1 + growthRate);
    result.push({ age: endAge, balance, brokerageIncome, srsReinvestment });
  }

  return result;
}

export const SRS_WITHDRAWAL_YEARS = 10;
export const SRS_TAXABLE_FRACTION = 0.5;

export type SrsWithdrawal = {
  srsPot: number;
  yearlyWithdrawal: number;
  taxablePerYear: number;
  taxPerYear: number;
  totalTax: number;
  netFromSrs: number;
};

export function calculateSrsWithdrawal(
  srsPot: number,
  years: number = SRS_WITHDRAWAL_YEARS,
): SrsWithdrawal {
  const yearlyWithdrawal = srsPot / years;
  const taxablePerYear = yearlyWithdrawal * SRS_TAXABLE_FRACTION;
  const taxPerYear = calculateTax(taxablePerYear);
  const totalTax = taxPerYear * years;
  return {
    srsPot,
    yearlyWithdrawal,
    taxablePerYear,
    taxPerYear,
    totalTax,
    netFromSrs: srsPot - totalTax,
  };
}
