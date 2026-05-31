"use client";

import { LumpsumExpense } from "@/lib/profile-context";
import { fmtMoney } from "@/lib/format";
import { Th } from "@/app/components/ui";

type Props = {
  title: string;
  description: string;
  rows: LumpsumExpense[];
  onChange: (rows: LumpsumExpense[]) => void;
  totalAccent: "red" | "emerald";
  idPrefix: string;
  lockedIds?: Set<string>;
};

export function LumpsumTable({
  title,
  description,
  rows,
  onChange,
  totalAccent,
  idPrefix,
  lockedIds,
}: Props) {
  function update(id: string, field: keyof LumpsumExpense, value: string | number) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function add() {
    onChange([
      ...rows,
      { id: `${idPrefix}-${Date.now()}`, age: 0, name: "", amount: 0 },
    ]);
  }

  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const totalColor = totalAccent === "red" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="border border-foreground/10 bg-foreground/[0.03] p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-foreground/85 dark:text-foreground/60 text-xs mt-0.5">{description}</p>
        </div>
        <button
          onClick={add}
          className="text-xs px-3 py-1.5 border border-foreground/15 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 text-foreground/85 dark:text-foreground/60 transition-colors cursor-pointer shrink-0"
        >
          + Add row
        </button>
      </div>
      <div className="border border-foreground/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.06]">
            <tr className="text-left text-foreground/85 dark:text-foreground/60 border-b border-foreground/10">
              <Th>Age</Th>
              <Th>Name</Th>
              <Th>Amount</Th>
              <th className="py-2 px-2 w-8" />
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => {
              const locked = lockedIds?.has(r.id) ?? false;
              return (
                <tr key={r.id} className={`border-b border-foreground/5 ${locked ? "bg-foreground/[0.02]" : "hover:bg-foreground/[0.04]"}`}>
                  <td className="py-2 px-2 w-20">
                    {locked ? (
                      <span className="w-16 inline-block text-center text-foreground/70 font-mono text-sm">{r.age}</span>
                    ) : (
                      <input
                        type="number"
                        value={r.age}
                        step={1}
                        onChange={(e) => update(r.id, "age", parseInt(e.target.value) || 0)}
                        className="w-16 bg-foreground/10 border border-foreground/15 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 text-center"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {locked ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground/70 px-1 py-0.5 text-sm">{r.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400 font-sans">from BTO</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => update(r.id, "name", e.target.value)}
                        className="w-full bg-transparent outline-none border-b border-transparent hover:border-foreground/20 focus:border-emerald-500 px-1 py-0.5 transition-colors"
                      />
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {locked ? (
                      <span className="text-foreground/70 font-mono text-sm">{fmtMoney(r.amount)}</span>
                    ) : (
                      <div className="flex items-center rounded-xl border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500 w-32">
                        <span className="pl-2 text-foreground/75 dark:text-foreground/50 font-mono text-xs">$</span>
                        <input
                          type="number"
                          value={r.amount}
                          step={1000}
                          min={0}
                          onChange={(e) => update(r.id, "amount", parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent px-2 py-1.5 outline-none font-mono text-sm"
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {!locked && (
                      <button
                        onClick={() => remove(r.id)}
                        className="text-foreground/60 dark:text-foreground/30 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground/15 bg-foreground/[0.04] font-medium">
              <td className="py-3 px-2 text-sm text-foreground/70" colSpan={2}>Total</td>
              <td className={`py-3 px-2 font-mono text-sm ${totalColor}`}>
                {fmtMoney(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
