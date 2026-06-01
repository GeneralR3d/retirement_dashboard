import { calculateTax, CPF_EMPLOYEE_RATE, EXPENSES_INFLATION_RATE, TAX_RELIEF_CAP } from "./tax";

export type AccumulationRow = {
  age: number;
  year: number;
  salary: number;
  takeHome: number;
  tax: number;
  totalTaxRelief: number;
  srsTopUp: number;
  srsTaxSavings: number;
  livingExpenses: number;
  baseLiving: number;
  lumpsumThisYear: number;
  lumpsumName: string;
  lumpsumInflowThisYear: number;
  lumpsumInflowName: string;
  cashTarget: number;
  cashTopup: number;
  cashBalanceBefore: number;
  cashBalance: number;
  invested: number;
  brokerageBalance: number;
};

export type LumpsumExpenseInput = { age: number; name: string; amount: number };

export type AccumulationInputs = {
  currentAge: number;
  stopWorkingAge: number;
  startingSalary: number;
  salaryGrowthRate: number;
  salarySeries?: number[];
  monthlyExpensesToday: number;
  monthlyExpenseSeries?: number[];
  emergencyMonths: number;
  lumpsumExpenses: LumpsumExpenseInput[];
  lumpsumInflows?: LumpsumExpenseInput[];
  cashStart: number;
  brokerageStart: number;
  investmentGrowthRate: number;
  expensesInflationRate?: number;
  srsTopUps?: number[];
  taxReliefsPerYear?: Record<string, number>[];
};

export function buildAccumulation(inputs: AccumulationInputs): AccumulationRow[] {
  const {
    currentAge,
    stopWorkingAge,
    startingSalary,
    salaryGrowthRate,
    salarySeries,
    monthlyExpensesToday,
    monthlyExpenseSeries,
    emergencyMonths,
    lumpsumExpenses,
    lumpsumInflows = [],
    cashStart,
    brokerageStart,
    investmentGrowthRate,
    expensesInflationRate = EXPENSES_INFLATION_RATE,
    srsTopUps,
    taxReliefsPerYear,
  } = inputs;

  const workingYears = Math.max(0, stopWorkingAge - currentAge);
  const rows: AccumulationRow[] = [];
  let cashBalance = cashStart;
  let brokerageBalance = brokerageStart;

  for (let i = 0; i < workingYears; i++) {
    const age = currentAge + i;
    const salary = salarySeries?.[i] ?? startingSalary * Math.pow(1 + salaryGrowthRate, i);
    const cpf = salary * CPF_EMPLOYEE_RATE;
    const takeHome = salary - cpf;
    const srsTopUp = Math.min(srsTopUps?.[i] ?? 0, Math.max(0, takeHome));
    const rawReliefs = taxReliefsPerYear?.[i] ?? {};
    const donationAmount = rawReliefs["donation_amount"] ?? 0;
    const donationDeduction = donationAmount * 2.5;
    const reliefSum = Object.entries(rawReliefs)
      .filter(([k]) => k !== "donation_amount")
      .reduce((s, [, v]) => s + v, 0);
    const totalTaxRelief = Math.min(TAX_RELIEF_CAP, reliefSum) + donationDeduction;
    const taxBase = Math.max(0, takeHome - srsTopUp - totalTaxRelief);
    const tax = calculateTax(taxBase);
    const srsTaxSavings = srsTopUp > 0 ? calculateTax(Math.max(0, takeHome - totalTaxRelief)) - tax : 0;

    const monthly = monthlyExpenseSeries?.[i] ?? monthlyExpensesToday;
    const inflationFactor = Math.pow(1 + expensesInflationRate, i);
    const baseLiving = monthly * 12 * inflationFactor;

    const matchingLumpsums = lumpsumExpenses.filter((l) => l.age === age && l.amount > 0);
    const lumpsumThisYear = matchingLumpsums.reduce((s, l) => s + l.amount, 0);
    const lumpsumName =
      matchingLumpsums.length === 0
        ? ""
        : matchingLumpsums.length === 1
          ? matchingLumpsums[0].name
          : `${matchingLumpsums[0].name} +${matchingLumpsums.length - 1} more`;

    const matchingInflows = lumpsumInflows.filter((l) => l.age === age && l.amount > 0);
    const lumpsumInflowThisYear = matchingInflows.reduce((s, l) => s + l.amount, 0);
    const lumpsumInflowName =
      matchingInflows.length === 0
        ? ""
        : matchingInflows.length === 1
          ? matchingInflows[0].name
          : `${matchingInflows[0].name} +${matchingInflows.length - 1} more`;

    const livingExpenses = baseLiving + lumpsumThisYear;
    const cashTarget = monthly * emergencyMonths * inflationFactor;
    const available = takeHome - tax - livingExpenses + lumpsumInflowThisYear - srsTopUp;

    let cashTopup: number;
    if (available >= 0) {
      const cashGap = cashTarget - cashBalance;
      cashTopup = Math.max(0, Math.min(cashGap, available));
    } else {
      cashTopup = -Math.min(-available, Math.max(0, cashBalance));
    }
    const invested = available - cashTopup;

    const cashBalanceBefore = cashBalance;
    cashBalance = cashBalance + cashTopup;
    brokerageBalance = (brokerageBalance + invested) * (1 + investmentGrowthRate);

    rows.push({
      age,
      year: i + 1,
      salary,
      takeHome,
      tax,
      totalTaxRelief,
      srsTopUp,
      srsTaxSavings,
      livingExpenses,
      baseLiving,
      lumpsumThisYear,
      lumpsumName,
      lumpsumInflowThisYear,
      lumpsumInflowName,
      cashTarget,
      cashTopup,
      cashBalanceBefore,
      cashBalance,
      invested,
      brokerageBalance,
    });
  }

  return rows;
}
