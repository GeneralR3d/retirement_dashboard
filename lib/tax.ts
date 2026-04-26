export const SRS_ANNUAL_CAP = 15300;

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

export type YearRow = {
  year: number;
  salary: number;
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
};

export type ProjectionInputs = {
  startingSalary: number;
  salaryGrowthRate: number; // decimal, e.g. 0.04
  investmentGrowthRate: number; // decimal, e.g. 0.07
  livingExpensePct: number; // decimal of pre-tax salary
  years: number;
  srsCap?: number;
};

export function buildProjection(inputs: ProjectionInputs): YearRow[] {
  const {
    startingSalary,
    salaryGrowthRate,
    investmentGrowthRate,
    livingExpensePct,
    years,
    srsCap = SRS_ANNUAL_CAP,
  } = inputs;

  const rows: YearRow[] = [];
  let potNoSrs = 0;
  let srsPot = 0;
  let brokeragePotWithSrs = 0;

  for (let i = 0; i < years; i++) {
    const salary = startingSalary * Math.pow(1 + salaryGrowthRate, i);
    const livingExpenses = salary * livingExpensePct;
    const srsContribution = Math.min(srsCap, Math.max(0, salary));

    const taxNoSrs = calculateTax(salary);
    const taxWithSrs = calculateTax(Math.max(0, salary - srsContribution));
    const taxSavings = taxNoSrs - taxWithSrs;

    // Without SRS: invest whatever's left after tax + living expenses.
    const investedNoSrs = Math.max(0, salary - taxNoSrs - livingExpenses);

    // With SRS: SRS pot gets srsContribution, brokerage gets the rest after
    // tax (on reduced taxable income) and living expenses. Total invested =
    // salary - taxWithSrs - livingExpenses (split across the two accounts).
    const brokerageWithSrs = Math.max(
      0,
      salary - srsContribution - taxWithSrs - livingExpenses,
    );
    const investedWithSrs = srsContribution + brokerageWithSrs;

    potNoSrs = (potNoSrs + investedNoSrs) * (1 + investmentGrowthRate);
    srsPot = (srsPot + srsContribution) * (1 + investmentGrowthRate);
    brokeragePotWithSrs =
      (brokeragePotWithSrs + brokerageWithSrs) * (1 + investmentGrowthRate);
    const potWithSrs = srsPot + brokeragePotWithSrs;

    rows.push({
      year: i + 1,
      salary,
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
    });
  }

  return rows;
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
