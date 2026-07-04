"use client";

import { useMemo } from "react";
import { useProfile } from "@/lib/profile-context";
import { buildFullProjection } from "@/lib/projection";
import { fmtMoney } from "@/lib/format";
import { StatCard } from "@/app/components/ui";
import SmartSummary from "@/app/components/smart-summary";

/**
 * Live projection sidebar for the Calculator page. Always computed from the
 * *saved* profile inputs, so it refreshes when any card's Recalculate commits.
 */
export default function AtAGlance() {
  const { inputs, saveCount } = useProfile();

  const {
    canRetire,
    runOutRow,
    netWorthData,
    peakNwRow,
    peakRow,
    retirementBrokerageBalance,
    oaTransferAge,
    summary,
  } = useMemo(() => buildFullProjection(inputs), [inputs]);

  return (
    <aside className="glass-card p-6 sm:p-7 space-y-6">
      <div>
        <h2 className="font-semibold text-lg">At a glance</h2>
        <p className="text-foreground/85 dark:text-foreground/60 text-xs mt-0.5">
          Based on your saved settings. Press Recalculate on any card to update.
        </p>
      </div>

      {/* Verdict */}
      <div className="text-center py-2">
        {canRetire ? (
          <h3 className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            You can retire at age{" "}
            <span className="text-4xl font-black italic">{inputs.stopWorkingAge}</span>
          </h3>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">
              You cannot retire at age{" "}
              <span className="text-4xl font-black italic">{inputs.stopWorkingAge}</span>
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400/70 mt-1">
              You will run out of money at age {runOutRow!.age}
            </p>
          </>
        )}
      </div>

      {/* KPI cards — mirrors the top of the Networth page */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatCard
          label="Net worth today"
          value={fmtMoney(netWorthData[0]?.total ?? 0)}
          sub={`at age ${inputs.currentAge}`}
        />
        <StatCard
          label="Peak net worth"
          value={fmtMoney(peakNwRow.total)}
          sub={`at age ${peakNwRow.age}`}
          accent="emerald"
        />
      </div>

      {/* Summary */}
      <div className="glass-inset p-5 max-h-[40vh] overflow-y-auto">
        <SmartSummary
          embedded
          open
          canRetire={canRetire}
          stopWorkingAge={inputs.stopWorkingAge}
          runOutAge={runOutRow?.age}
          currentAge={inputs.currentAge}
          deathAge={inputs.deathAge}
          monthlyExpensesToday={inputs.monthlyExpensesToday}
          monthlyExpensesRetirement={inputs.monthlyExpensesRetirement}
          monthlyExpenseSeries={inputs.monthlyExpenseSeries}
          retirementBrokerageBalance={retirementBrokerageBalance}
          peakBrokerageBalance={peakRow?.balance ?? 0}
          peakBrokerageAge={peakRow?.age ?? inputs.stopWorkingAge}
          oaTransferAge={oaTransferAge}
          cpfWithdrawalAge={inputs.cpfWithdrawalAge}
          data={summary}
          targetWidth={0}
          generationKey={saveCount}
        />
      </div>
    </aside>
  );
}
