import type { ProfileInputs } from "./profile-context";
import { buildCpfProjection, type CpfYearRow } from "./tax";

export const HDB_LOAN_RATE = 0.026;
export const MAX_TENURE_HDB = 25;
export const MAX_TENURE_BANK = 30;

// Loan eligibility limits.
export const LTV_CAP = 0.75; // loan cannot exceed 75% of flat price
export const MSR_LIMIT = 0.30; // monthly mortgage cannot exceed 30% of gross monthly income

export const GRANT_CAPS = {
  family: 80000,
  ehg: 120000,
  ehgSingle: 60000,
  phg: 30000,
} as const;

export type DownpaymentScheme = "normal" | "staggered" | "deferred";

export function getDownpaymentRatios(scheme: DownpaymentScheme, loanType: "hdb" | "bank" = "hdb"): { dp1: number; dp2: number } {
  if (loanType === "bank") {
    if (scheme === "staggered") return { dp1: 0.10, dp2: 0.15 };
    if (scheme === "deferred") return { dp1: 0.025, dp2: 0.225 };
    return { dp1: 0.20, dp2: 0.05 }; // normal
  }
  if (scheme === "staggered") return { dp1: 0.05, dp2: 0.20 };
  if (scheme === "deferred") return { dp1: 0.025, dp2: 0.225 };
  return { dp1: 0.10, dp2: 0.15 };
}

export function maxTenureFor(loanType: "hdb" | "bank"): number {
  return loanType === "hdb" ? MAX_TENURE_HDB : MAX_TENURE_BANK;
}

export function effectiveInterestRate(inputs: ProfileInputs): number {
  return inputs.btoLoanType === "hdb" ? HDB_LOAN_RATE : inputs.btoBankInterestRate;
}

export function ehgCapFor(inputs: ProfileInputs): number {
  return inputs.btoApplicantType === "single" ? GRANT_CAPS.ehgSingle : GRANT_CAPS.ehg;
}

export function rawGrantSum(inputs: ProfileInputs): number {
  const family = Math.min(inputs.btoGrantFamily, GRANT_CAPS.family);
  const ehg = Math.min(inputs.btoGrantEhg, ehgCapFor(inputs));
  const phg = Math.min(inputs.btoGrantPhg, GRANT_CAPS.phg);
  return family + ehg + phg;
}

export function totalGrantAmount(inputs: ProfileInputs): number {
  // Bank loans: grants always apply regardless of scheme.
  if (inputs.btoLoanType === "bank") return rawGrantSum(inputs);
  if (inputs.btoDownpaymentScheme === "deferred") return 0;
  return rawGrantSum(inputs);
}

function monthlyAmortization(principal: number, annualRate: number, years: number): number {
  const n = years * 12;
  if (n <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

// Inverse of monthlyAmortization: largest principal whose monthly instalment equals `monthly`.
function maxLoanForMonthly(monthly: number, annualRate: number, years: number): number {
  const n = years * 12;
  if (n <= 0 || monthly <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return monthly * n;
  const factor = Math.pow(1 + r, n);
  return (monthly * (factor - 1)) / (r * factor);
}

// Gross monthly salary at a given age, from the salary override series when available,
// otherwise the growth formula. Returns 0 once the user has stopped working (no income).
export function grossMonthlyIncomeAt(inputs: ProfileInputs, age: number): number {
  const workingYears = Math.max(0, inputs.stopWorkingAge - inputs.currentAge);
  const i = age - inputs.currentAge;
  if (i >= workingYears) return 0; // no employment income after stopping work
  const idx = Math.max(0, i);
  const salary =
    inputs.salarySeries.length === workingYears && idx < inputs.salarySeries.length
      ? inputs.salarySeries[idx]
      : inputs.startingSalary * Math.pow(1 + inputs.salaryGrowthRate, idx);
  return salary / 12;
}

export type BtoBreakdown = {
  flatPrice: number;
  scheme: DownpaymentScheme;
  totalGrant: number;
  dp1Amount: number;
  dp2Amount: number;
  totalDownpayment: number;
  loanAmount: number;
  ltvRatio: number;
  interestRate: number;
  // Eligibility limits (theoretical maximums the buyer qualifies for).
  grossMonthlyIncomeAtApplication: number;
  // Age at which income is assessed for MSR/grants — application age normally,
  // collection age under the Deferred Income Assessment (DIA) Scheme.
  incomeAssessmentAge: number;
  maxLoanLtv: number;
  maxLoanMsr: number;
  maxLoan: number;
  maxMonthlyMortgage: number;
  // Whether the flat's required loan was capped by the limits, and the cash the buyer
  // must top up at collection as a result.
  loanConstrained: boolean;
  loanShortfallToCash: number;
  dp1: {
    proposed: number;
    fromGrant: number;
    fromOA: number;
    fromCash: number;
    oaAvailable: number;
  };
  dp2: {
    proposed: number;
    actualPaid: number;
    fromGrantLeftover: number;
    fromOA: number;
    fromCash: number;
    oaAvailable: number;
  };
  leftoverGrantAfterDp1: number;
  monthlyMortgage: number;
  mortgageStartAge: number;
  mortgageEndAge: number;
};

export function computeBtoBreakdown(
  inputs: ProfileInputs,
  oaAtDp1Age: number,
  oaAtDp2Age: number,
): BtoBreakdown {
  const flatPrice = inputs.btoFlatPrice;
  const scheme = inputs.btoDownpaymentScheme;
  const loanType = inputs.btoLoanType;
  const ratios = getDownpaymentRatios(scheme, loanType);
  const dp1Amount = flatPrice * ratios.dp1;
  const dp2Amount = flatPrice * ratios.dp2;

  const totalGrant = totalGrantAmount(inputs);
  const isDeferred = scheme === "deferred";
  const isBankLoan = loanType === "bank";

  // DP1 allocation differs by loan type:
  //   Bank loan: 5% of flat price is mandatory cash; remaining 15% from grant → OA → cash.
  //   HDB deferred: no grant or OA at DP1, all carries forward to DP2.
  //   HDB normal/staggered: grant → OA → cash for the full DP1 amount.
  let dp1FromGrant: number;
  let dp1FromOA: number;
  let dp1FromCash: number;
  let leftoverGrantAfterDp1: number;

  if (isBankLoan) {
    // Deferred: full DP1 is mandatory cash (no flex). Normal/staggered: 5% cash floor, rest is flex.
    const isBankDeferred = scheme === "deferred";
    const dp1CashFloor = isBankDeferred ? dp1Amount : flatPrice * 0.05;
    const dp1FlexAmount = dp1Amount - dp1CashFloor;
    dp1FromGrant = Math.min(totalGrant, dp1FlexAmount);
    const dp1FlexAfterGrant = dp1FlexAmount - dp1FromGrant;
    dp1FromOA = Math.min(dp1FlexAfterGrant, Math.max(0, oaAtDp1Age));
    dp1FromCash = dp1CashFloor + Math.max(0, dp1FlexAfterGrant - dp1FromOA);
    leftoverGrantAfterDp1 = Math.max(0, totalGrant - dp1FromGrant);
  } else if (isDeferred) {
    dp1FromGrant = 0;
    dp1FromOA = 0;
    dp1FromCash = dp1Amount;
    leftoverGrantAfterDp1 = rawGrantSum(inputs);
  } else {
    dp1FromGrant = Math.min(totalGrant, dp1Amount);
    const dp1Remaining = dp1Amount - dp1FromGrant;
    dp1FromOA = Math.min(dp1Remaining, Math.max(0, oaAtDp1Age));
    dp1FromCash = Math.max(0, dp1Remaining - dp1FromOA);
    leftoverGrantAfterDp1 = Math.max(0, totalGrant - dp1FromGrant);
  }

  // DP2 allocation. Bank deferred has a 2.5% mandatory cash floor; all other schemes have no cash floor.
  // Grant is applied to the flex portion (dp2Amount - dp2CashFloor). If grant exceeds the flex amount,
  // the overflow reduces the loan (actualPaid > dp2Amount).
  const dp2CashFloor = (isBankLoan && scheme === "deferred") ? flatPrice * 0.025 : 0;
  const dp2FlexAmount = dp2Amount - dp2CashFloor;
  const dp2FromGrantLeftover = leftoverGrantAfterDp1;
  let dp2FromOA = 0;
  let dp2FromCash = dp2CashFloor;
  let dp2ActualPaid: number;
  if (dp2FromGrantLeftover >= dp2FlexAmount) {
    // Grant covers the entire flex portion; excess reduces the loan.
    dp2ActualPaid = dp2CashFloor + dp2FromGrantLeftover;
  } else {
    const dp2FlexAfterGrant = dp2FlexAmount - dp2FromGrantLeftover;
    dp2FromOA = Math.min(dp2FlexAfterGrant, Math.max(0, oaAtDp2Age));
    dp2FromCash = dp2CashFloor + Math.max(0, dp2FlexAfterGrant - dp2FromOA);
    dp2ActualPaid = dp2Amount;
  }

  const interestRate = effectiveInterestRate(inputs);
  const tenure = inputs.btoLoanTenureYears;

  // Loan the flat would nominally require, before eligibility limits.
  const nominalLoan = Math.max(0, flatPrice - (dp1Amount + dp2ActualPaid));

  // Eligibility limits — the buyer can borrow at most the lower of the LTV cap and
  // the MSR-implied ceiling (monthly instalment ≤ 30% of gross monthly income).
  // Under the Deferred Income Assessment (DIA) Scheme (deferred downpayment), HDB
  // assesses income at collection (DP2) instead of application (DP1), so the income
  // that sizes MSR and grants is taken at the later, typically higher, salary.
  const incomeAssessmentAge = isDeferred ? inputs.btoCollectionAge : inputs.btoApplicationAge;
  const grossMonthlyIncomeAtApplication = grossMonthlyIncomeAt(inputs, incomeAssessmentAge);
  const maxLoanLtv = flatPrice * LTV_CAP;
  const maxMonthlyMsr = grossMonthlyIncomeAtApplication * MSR_LIMIT;
  const maxLoanMsr = maxLoanForMonthly(maxMonthlyMsr, interestRate, tenure);
  const maxLoan = Math.max(0, Math.min(maxLoanLtv, maxLoanMsr));
  const maxMonthlyMortgage = monthlyAmortization(maxLoan, interestRate, tenure);

  // Cap the actual loan at the eligibility ceiling; the un-loanable shortfall must be
  // paid in cash at collection (same timing as DP2), so the accounting stays consistent
  // (flatPrice = totalDownpayment + loanAmount).
  const loanAmount = Math.min(nominalLoan, maxLoan);
  const loanShortfallToCash = Math.max(0, nominalLoan - loanAmount);
  const loanConstrained = loanShortfallToCash > 0.5;
  dp2FromCash += loanShortfallToCash;
  dp2ActualPaid += loanShortfallToCash;

  const totalDownpayment = dp1Amount + dp2ActualPaid;
  const ltvRatio = flatPrice > 0 ? loanAmount / flatPrice : 0;

  const monthlyMortgage = monthlyAmortization(loanAmount, interestRate, tenure);
  const mortgageStartAge = inputs.btoCollectionAge;
  const mortgageEndAge = inputs.btoCollectionAge + inputs.btoLoanTenureYears - 1;

  return {
    flatPrice,
    scheme,
    totalGrant,
    dp1Amount,
    dp2Amount,
    totalDownpayment,
    loanAmount,
    ltvRatio,
    interestRate,
    grossMonthlyIncomeAtApplication,
    incomeAssessmentAge,
    maxLoanLtv,
    maxLoanMsr,
    maxLoan,
    maxMonthlyMortgage,
    loanConstrained,
    loanShortfallToCash,
    dp1: {
      proposed: dp1Amount,
      fromGrant: dp1FromGrant,
      fromOA: dp1FromOA,
      fromCash: dp1FromCash,
      oaAvailable: oaAtDp1Age,
    },
    dp2: {
      proposed: dp2Amount,
      actualPaid: dp2ActualPaid,
      fromGrantLeftover: dp2FromGrantLeftover,
      fromOA: dp2FromOA,
      fromCash: dp2FromCash,
      oaAvailable: oaAtDp2Age,
    },
    leftoverGrantAfterDp1,
    monthlyMortgage,
    mortgageStartAge,
    mortgageEndAge,
  };
}

function oaAt(rows: CpfYearRow[], age: number, fallback: number): number {
  const row = rows.find((r) => r.age === age);
  if (row) return row.oaBalance;
  if (rows.length === 0 || age < rows[0].age) return fallback;
  return rows[rows.length - 1].oaBalance;
}

// Returns per-age cash amounts the owner must pay for the mortgage (i.e. the portion
// not covered by CPF OA). Only years where cash > 0 are included.
export function computeMortgageCashPayments(inputs: ProfileInputs): { age: number; amount: number }[] {
  if (inputs.btoFlatPrice <= 0) return [];

  const cpfBase = {
    currentAge: inputs.currentAge,
    stopWorkingAge: inputs.stopWorkingAge,
    cpfWithdrawalAge: inputs.cpfWithdrawalAge,
    cpfRetirementAge: inputs.cpfRetirementAge,
    startingSalary: inputs.startingSalary,
    salaryGrowthRate: inputs.salaryGrowthRate,
    cpfOA: inputs.cpfOA,
    cpfSA: inputs.cpfSA,
    cpfMA: inputs.cpfMA,
    cpfRA: inputs.cpfRA,
    cpfLifeFrs: inputs.cpfLifeFrs,
    endAge: inputs.deathAge,
    salarySeries:
      inputs.salarySeries.length === Math.max(0, inputs.stopWorkingAge - inputs.currentAge)
        ? inputs.salarySeries
        : undefined,
  };

  // Pass 1 — no BTO deductions
  const pass1 = buildCpfProjection(cpfBase);
  const oa1 = oaAt(pass1, inputs.btoApplicationAge, inputs.cpfOA);

  // Pass 2 — DP1 deduction only, to get accurate OA at DP2 age
  const bto1 = computeBtoBreakdown(inputs, oa1, 0);
  const dp1Deds = bto1.dp1.fromOA > 0
    ? [{ age: inputs.btoApplicationAge, amount: bto1.dp1.fromOA }]
    : [];
  const pass2 = buildCpfProjection({ ...cpfBase, oaDeductions: dp1Deds });
  const oa2 = oaAt(pass2, inputs.btoCollectionAge, inputs.cpfOA);

  // Full BTO breakdown
  const bto = computeBtoBreakdown(inputs, oa1, oa2);
  if (bto.monthlyMortgage <= 0) return [];

  const annualMortgage = bto.monthlyMortgage * 12;

  // Pass 3 — all BTO deductions (DP1, DP2, and full mortgage period)
  const allDeds: { age: number; amount: number }[] = [];
  if (bto.dp1.fromOA > 0) allDeds.push({ age: inputs.btoApplicationAge, amount: bto.dp1.fromOA });
  if (bto.dp2.fromOA > 0) allDeds.push({ age: inputs.btoCollectionAge, amount: bto.dp2.fromOA });
  for (let age = inputs.btoCollectionAge; age <= bto.mortgageEndAge; age++) {
    allDeds.push({ age, amount: annualMortgage });
  }
  const pass3 = buildCpfProjection({ ...cpfBase, oaDeductions: allDeds });

  const result: { age: number; amount: number }[] = [];

  // Year 0 of mortgage (btoCollectionAge): DP2 is deducted before the mortgage payment,
  // so only the remaining OA after DP2 can cover the mortgage.
  const oaAfterDp2 = Math.max(0, oa2 - bto.dp2.fromOA);
  const cashAtCollection = Math.max(0, annualMortgage - Math.min(annualMortgage, oaAfterDp2));
  if (cashAtCollection > 0) result.push({ age: inputs.btoCollectionAge, amount: cashAtCollection });

  // Subsequent mortgage years: oaDeducted in pass3 is solely the mortgage deduction
  for (let k = 1; k < inputs.btoLoanTenureYears; k++) {
    const age = inputs.btoCollectionAge + k;
    const row = pass3.find((r) => r.age === age);
    const fromCash = annualMortgage - (row?.oaDeducted ?? 0);
    if (fromCash > 0) result.push({ age, amount: fromCash });
  }

  return result;
}
