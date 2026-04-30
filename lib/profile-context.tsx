"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Investment = {
  id: string;
  name: string;
  value: number;
  returnRate: number;
};

const DEFAULT_INVESTMENTS: Investment[] = [
  { id: "stocks",  name: "Stocks & ETFs",               value: 5000, returnRate: 0.07  },
  { id: "bonds",   name: "Bonds & Money Market Funds",   value: 0,    returnRate: 0.03  },
  { id: "cash",    name: "Cash",                         value: 0,    returnRate: 0.005 },
  { id: "fd",      name: "Fixed Deposits",               value: 0,    returnRate: 0.035 },
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
  monthlyExpensesToday: 4000,
  investments: DEFAULT_INVESTMENTS,
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
