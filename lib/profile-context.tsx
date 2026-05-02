"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Investment = {
  id: string;
  name: string;
  value: number;
  returnRate: number;
};

const DEFAULT_INVESTMENTS: Investment[] = [
  { id: "stocks",  name: "Stocks & ETFs",               value: 5000, returnRate: 0.06  },
  { id: "bonds",   name: "Bonds & Money Market Funds",   value: 0,    returnRate: 0.03  },
  { id: "fd",      name: "Fixed Deposits",               value: 0,    returnRate: 0.035 },
];

export type LumpsumExpense = {
  id: string;
  age: number;
  name: string;
  amount: number;
};

const DEFAULT_LUMPSUM_EXPENSES: LumpsumExpense[] = [
  { id: "exp-1", age: 0, name: "BTO Downpayment one", amount: 0 },
  { id: "exp-2", age: 0, name: "BTO Downpayment two", amount: 0 },
  { id: "exp-3", age: 0, name: "Wedding", amount: 0 },
  { id: "exp-4", age: 0, name: "Renovation", amount: 0 },
  { id: "exp-5", age: 0, name: "Honeymoon", amount: 0 },
  { id: "exp-6", age: 0, name: "Car Downpayment", amount: 0 },
];

const DEFAULT_LUMPSUM_INFLOWS: LumpsumExpense[] = [
  { id: "inflow-1", age: 0, name: "Inheritance", amount: 0 },
  { id: "inflow-2", age: 0, name: "TOTO", amount: 0 },
];

export type ProfileInputs = {
  currentAge: number;
  stopWorkingAge: number;
  cpfWithdrawalAge: number;
  cpfRetirementAge: number;
  deathAge: number;
  startingSalary: number;
  salaryGrowthRate: number;
  investmentGrowthRate: number;
  investmentGrowthRateRetirement: number;
  livingExpensePct: number;
  srsWithdrawalAge: number;
  cpfOA: number;
  cpfSA: number;
  cpfMA: number;
  cpfRA: number;
  cpfLifeFrs: number;
  cpfLifeMonthlyPayout: number;
  salarySeries: number[];
  startingCash: number;
  monthlyExpensesToday: number;
  investments: Investment[];
  cash: number;
  emergencyMonths: number;
  monthlyExpenseSeries: number[];
  lumpsumExpenses: LumpsumExpense[];
  lumpsumInflows: LumpsumExpense[];
  monthlyExpensesRetirement: number;
  srsAnnualCap: number;
  srsAccepted: boolean[]; // per working-year accept/reject; [] = all accepted (default)
  btoApplicantType: "single" | "couple";
  btoFlatPrice: number;
  btoApplicationAge: number;
  btoCollectionAge: number;
  btoDownpaymentScheme: "normal" | "staggered" | "deferred";
  btoGrantFamily: number;
  btoGrantEhg: number;
  btoGrantPhg: number;
  btoLoanType: "hdb" | "bank";
  btoBankInterestRate: number;
  btoLoanTenureYears: number;
};

export const CPF_RATES = {
  OA: 0.025,
  SA: 0.04,
  MA: 0.04,
  RA: 0.04,
} as const;

const DEFAULTS: ProfileInputs = {
  currentAge: 25,
  stopWorkingAge: 55,
  cpfWithdrawalAge: 65,
  cpfRetirementAge: 55,
  deathAge: 83,
  startingSalary: 70000,
  salaryGrowthRate: 0.02,
  investmentGrowthRate: 0.07,
  investmentGrowthRateRetirement: 0.025,
  livingExpensePct: 0.7,
  srsWithdrawalAge: 63,
  cpfOA: 6153.64,
  cpfSA: 2000.74,
  cpfMA: 5236,
  cpfRA: 0,
  cpfLifeFrs: 200000,
  cpfLifeMonthlyPayout: 1610,
  salarySeries: [],
  startingCash: 5000,
  monthlyExpensesToday: 3000,
  investments: DEFAULT_INVESTMENTS,
  cash: 10000,
  emergencyMonths: 5,
  monthlyExpenseSeries: [],
  lumpsumExpenses: DEFAULT_LUMPSUM_EXPENSES,
  lumpsumInflows: DEFAULT_LUMPSUM_INFLOWS,
  monthlyExpensesRetirement: 3000,
  srsAnnualCap: 15300,
  srsAccepted: [],
  btoApplicantType: "couple",
  btoFlatPrice: 500000,
  btoApplicationAge: 28,
  btoCollectionAge: 32,
  btoDownpaymentScheme: "normal",
  btoGrantFamily: 0,
  btoGrantEhg: 0,
  btoGrantPhg: 0,
  btoLoanType: "hdb",
  btoBankInterestRate: 0.035,
  btoLoanTenureYears: 25,
};

type ProfileContextType = {
  inputs: ProfileInputs;
  setInputs: (next: ProfileInputs) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  inputs: DEFAULTS,
  setInputs: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [inputs, setInputsState] = useState<ProfileInputs>(DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem("profile");
    if (stored) {
      try {
        setInputsState({ ...DEFAULTS, ...JSON.parse(stored) });
      } catch {
        // ignore malformed localStorage
      }
    }
  }, []);

  function setInputs(next: ProfileInputs) {
    setInputsState(next);
    localStorage.setItem("profile", JSON.stringify(next));
  }

  return (
    <ProfileContext.Provider value={{ inputs, setInputs }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
