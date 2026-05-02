import type { ProfileInputs } from "./profile-context";
import { buildCpfProjection, type CpfYearRow } from "./tax";

export const HDB_LOAN_RATE = 0.026;
export const MAX_TENURE_HDB = 25;
export const MAX_TENURE_BANK = 30;

export const GRANT_CAPS = {
  family: 80000,
  ehg: 120000,
  phg: 30000,
} as const;

export type DownpaymentScheme = "normal" | "staggered" | "deferred";

export function getDownpaymentRatios(scheme: DownpaymentScheme): { dp1: number; dp2: number } {
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

export function rawGrantSum(inputs: ProfileInputs): number {
  const family = Math.min(inputs.btoGrantFamily, GRANT_CAPS.family);
  const ehg = Math.min(inputs.btoGrantEhg, GRANT_CAPS.ehg);
  const phg = Math.min(inputs.btoGrantPhg, GRANT_CAPS.phg);
  return family + ehg + phg;
}

export function totalGrantAmount(inputs: ProfileInputs): number {
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
  const ratios = getDownpaymentRatios(scheme);
  const dp1Amount = flatPrice * ratios.dp1;
  const dp2Amount = flatPrice * ratios.dp2;

  const totalGrant = totalGrantAmount(inputs);
  const isDeferred = scheme === "deferred";

  // DP1 allocation: grant -> OA -> cash. Grant capped at dp1Amount.
  // Deferred scheme: no grant applied at DP1 (grant carries forward to DP2).
  const dp1FromGrant = isDeferred ? 0 : Math.min(totalGrant, dp1Amount);
  const dp1Remaining = dp1Amount - dp1FromGrant;
  const dp1FromOA = Math.min(dp1Remaining, Math.max(0, oaAtDp1Age));
  const dp1FromCash = Math.max(0, dp1Remaining - dp1FromOA);

  const leftoverGrantAfterDp1 = isDeferred
    ? rawGrantSum(inputs)
    : Math.max(0, totalGrant - dp1FromGrant);

  // DP2 allocation: leftover grant fully applied (not capped). If exceeds proposed, actualPaid = leftoverGrant.
  const dp2FromGrantLeftover = leftoverGrantAfterDp1;
  let dp2FromOA = 0;
  let dp2FromCash = 0;
  let dp2ActualPaid = dp2FromGrantLeftover;
  if (dp2FromGrantLeftover < dp2Amount) {
    const dp2Remaining = dp2Amount - dp2FromGrantLeftover;
    dp2FromOA = Math.min(dp2Remaining, Math.max(0, oaAtDp2Age));
    dp2FromCash = Math.max(0, dp2Remaining - dp2FromOA);
    dp2ActualPaid = dp2Amount;
  }

  const totalDownpayment = dp1Amount + dp2ActualPaid;
  const loanAmount = Math.max(0, flatPrice - totalDownpayment);
  const ltvRatio = flatPrice > 0 ? loanAmount / flatPrice : 0;
  const interestRate = effectiveInterestRate(inputs);

  const monthlyMortgage = monthlyAmortization(loanAmount, interestRate, inputs.btoLoanTenureYears);
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
