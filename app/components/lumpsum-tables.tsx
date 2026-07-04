"use client";

import { useMemo } from "react";
import { ProfileInputs, LumpsumExpense } from "@/lib/profile-context";
import { buildCpfProjection } from "@/lib/tax";
import { computeBtoBreakdown } from "@/lib/bto";
import { LumpsumTable } from "./lumpsum-table";

export function useBtoEffectiveExpenses(
  profileInputs: ProfileInputs,
  lumpsumExpenses: LumpsumExpense[],
) {
  const workingYears = Math.max(0, profileInputs.stopWorkingAge - profileInputs.currentAge);

  const cpfRowsForBto = useMemo(() => {
    if (profileInputs.btoFlatPrice <= 0) return [];
    return buildCpfProjection({
      currentAge: profileInputs.currentAge,
      stopWorkingAge: profileInputs.stopWorkingAge,
      cpfWithdrawalAge: profileInputs.cpfWithdrawalAge,
      cpfRetirementAge: profileInputs.cpfRetirementAge,
      startingSalary: profileInputs.startingSalary,
      salaryGrowthRate: profileInputs.salaryGrowthRate,
      cpfOA: profileInputs.cpfOA,
      cpfSA: profileInputs.cpfSA,
      cpfMA: profileInputs.cpfMA,
      cpfRA: profileInputs.cpfRA,
      cpfLifeFrs: profileInputs.cpfLifeFrs,
      endAge: profileInputs.deathAge,
      salarySeries:
        profileInputs.salarySeries.length === workingYears ? profileInputs.salarySeries : undefined,
    });
  }, [profileInputs, workingYears]);

  const btoBreakdown = useMemo(() => {
    if (profileInputs.btoFlatPrice <= 0) return null;
    function oaAt(age: number): number {
      const row = cpfRowsForBto.find((r) => r.age === age);
      if (row) return row.oaBalance;
      if (cpfRowsForBto.length === 0 || age < cpfRowsForBto[0].age) return profileInputs.cpfOA;
      return cpfRowsForBto[cpfRowsForBto.length - 1].oaBalance;
    }
    return computeBtoBreakdown(
      profileInputs,
      oaAt(profileInputs.btoApplicationAge),
      oaAt(profileInputs.btoCollectionAge),
    );
  }, [cpfRowsForBto, profileInputs]);

  const effectiveExpenses = useMemo((): LumpsumExpense[] => {
    if (!btoBreakdown) return lumpsumExpenses;
    return lumpsumExpenses.map((r) => {
      if (r.id === "exp-1")
        return { ...r, age: profileInputs.btoApplicationAge, amount: btoBreakdown.dp1.fromCash };
      if (r.id === "exp-2")
        return { ...r, age: profileInputs.btoCollectionAge, amount: btoBreakdown.dp2.fromCash };
      return r;
    });
  }, [lumpsumExpenses, btoBreakdown, profileInputs.btoApplicationAge, profileInputs.btoCollectionAge]);

  const btoLockedIds = useMemo(
    () => (btoBreakdown ? new Set(["exp-1", "exp-2"]) : new Set<string>()),
    [btoBreakdown],
  );

  return { effectiveExpenses, btoLockedIds };
}

type Props = {
  profileInputs: ProfileInputs;
  lumpsumExpenses: LumpsumExpense[];
  lumpsumInflows: LumpsumExpense[];
  onExpensesChange: (rows: LumpsumExpense[]) => void;
  onInflowsChange: (rows: LumpsumExpense[]) => void;
};

export function LumpsumTablesPanel({
  profileInputs,
  lumpsumExpenses,
  lumpsumInflows,
  onExpensesChange,
  onInflowsChange,
}: Props) {
  const { effectiveExpenses, btoLockedIds } = useBtoEffectiveExpenses(profileInputs, lumpsumExpenses);

  return (
    <div className="grid grid-cols-1 gap-6">
      <LumpsumTable
        title="Lumpsum Inflows"
        description="One-time inflows (inheritance, bonuses, etc.) added to that year's available cash."
        rows={lumpsumInflows}
        onChange={onInflowsChange}
        totalAccent="emerald"
        idPrefix="inflow"
      />
      <LumpsumTable
        title="Lumpsum Expenses"
        description="One-time expenses applied at a specific age. Added on top of the monthly living expenses for that year."
        rows={effectiveExpenses}
        onChange={onExpensesChange}
        totalAccent="red"
        idPrefix="exp"
        lockedIds={btoLockedIds}
      />
    </div>
  );
}
