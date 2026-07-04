"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney } from "@/lib/format";

export type SmartSummaryData = {
  avgInvested: number;
  leftoverAtDeath: number;
  hasBto: boolean;
  mortgagePayoffAge: number;
  mortgageCashTotal: number;
  mortgageNeedsWithdrawal: boolean;
  oaRunOutAge: number | undefined;
  oaLeftAtTransfer: number;
  cpfLifePremium: number;
  cpfLifeMonthly: number;
};

export type Props = {
  open: boolean;
  canRetire: boolean;
  stopWorkingAge: number;
  runOutAge: number | undefined;
  currentAge: number;
  deathAge: number;
  monthlyExpensesToday: number;
  monthlyExpensesRetirement: number;
  monthlyExpenseSeries: number[];
  retirementBrokerageBalance: number;
  peakBrokerageBalance: number;
  peakBrokerageAge: number;
  oaTransferAge: number;
  cpfWithdrawalAge: number;
  data: SmartSummaryData;
  targetWidth: number;
  generationKey: number;
  /** Render inline (no slide-over width animation or card chrome) — used by the At a glance panel. */
  embedded?: boolean;
};

// --- Token types ---
type Style = "normal" | "bold" | "bold-emerald" | "bold-red";
type Tok =
  | { kind: "text"; style: Style; text: string }
  | { kind: "break" }
  | { kind: "list"; items: string[] };

const tx = (text: string, style: Style = "normal"): Tok => ({ kind: "text", style, text });
const BR: Tok = { kind: "break" };
const LIST = (items: string[]): Tok => ({ kind: "list", items });

// --- Paragraph types (after grouping tokens) ---
type TextGroup = { kind: "text"; toks: (Tok & { kind: "text" })[] };
type ListGroup = { kind: "list"; items: string[] };
type Paragraph = TextGroup | ListGroup;

type ExpenseRange = { fromAge: number; toAge: number; amount: number };

function collapseExpenseRanges(
  series: number[],
  fallback: number,
  currentAge: number,
  stopWorkingAge: number,
  retirementExpenses: number,
  deathAge: number,
): ExpenseRange[] {
  const ranges: ExpenseRange[] = [];
  const workingYears = stopWorkingAge - currentAge;

  for (let i = 0; i < workingYears; i++) {
    const amount = series[i] ?? fallback;
    const age = currentAge + i;
    const last = ranges[ranges.length - 1];
    if (!last || last.amount !== amount) {
      ranges.push({ fromAge: age, toAge: age, amount });
    } else {
      last.toAge = age;
    }
  }

  const last = ranges[ranges.length - 1];
  if (last && last.amount === retirementExpenses) {
    last.toAge = deathAge;
  } else {
    ranges.push({ fromAge: stopWorkingAge, toAge: deathAge, amount: retirementExpenses });
  }

  return ranges;
}

function ageRangeStr(from: number, to: number): string {
  return from === to ? `age ${from}` : `ages ${from}–${to}`;
}

function expenseRangeToks(ranges: ExpenseRange[]): Tok[] {
  const toks: Tok[] = [tx("By keeping monthly expenses at ")];

  ranges.forEach((r, i) => {
    toks.push(tx(fmtMoney(r.amount), "bold"));
    toks.push(tx(` (${ageRangeStr(r.fromAge, r.toAge)})`));
    if (i < ranges.length - 2) toks.push(tx(", "));
    else if (i === ranges.length - 2) toks.push(tx(", and "));
  });

  toks.push(tx(", you'll be able to invest "));
  return toks;
}

function failureExpenseRangeToks(ranges: ExpenseRange[]): Tok[] {
  const toks: Tok[] = [tx("With monthly expenses at ")];

  ranges.forEach((r, i) => {
    toks.push(tx(fmtMoney(r.amount), "bold"));
    toks.push(tx(` (${ageRangeStr(r.fromAge, r.toAge)})`));
    if (i < ranges.length - 2) toks.push(tx(", "));
    else if (i === ranges.length - 2) toks.push(tx(", and "));
  });

  toks.push(tx(", you'll only be able to invest "));
  return toks;
}

function buildTokens(p: Omit<Props, "open" | "targetWidth">): Tok[] {
  if (!p.canRetire) {
    const expenseRanges = collapseExpenseRanges(
      p.monthlyExpenseSeries,
      p.monthlyExpensesToday,
      p.currentAge,
      p.stopWorkingAge,
      p.monthlyExpensesRetirement,
      p.deathAge,
    );

    const toks: Tok[] = [
      tx("Not quite there. "),
      BR,
      ...failureExpenseRangeToks(expenseRanges),
      tx(fmtMoney(p.data.avgInvested), "bold"),
      tx(" on average each year into your investments, generating an investment net worth of only "),
      tx(fmtMoney(p.retirementBrokerageBalance), "bold-red"),
      tx(` at retirement (age ${p.stopWorkingAge}). Drawing these down starting at age ${p.stopWorkingAge}, your investments will run out by age `),
      tx(String(p.runOutAge ?? "unknown"), "bold-red"),
      tx("."),
      BR,
      tx("Here are some tips: "),
      LIST([
        "Reduce your monthly expenses, especially during your younger years.",
        `Push your retirement to a later age (currently ${p.stopWorkingAge}).`,
        `Lower your retirement expenses from ${fmtMoney(p.monthlyExpensesRetirement)}/month.`,
      ]),

      BR,
      tx(`Your investments will peak at age ${p.peakBrokerageAge} at `),
      tx(fmtMoney(p.peakBrokerageBalance), "bold"),
      tx("."),
      BR,
    ];

    if (p.data.hasBto) {
      if (p.data.mortgageNeedsWithdrawal) {
        toks.push(
          tx("Your CPF Ordinary Account can't fully cover the BTO mortgage — you'll need to top up "),
          tx(fmtMoney(p.data.mortgageCashTotal), "bold"),
          tx(" from cash and investments over the loan.")
        );
      } else {
        toks.push(tx("You'll pay off your BTO mortgage entirely from your CPF Ordinary Account — no need to dip into cash or investments."));
      }
      if (p.data.oaRunOutAge !== undefined) {
        toks.push(tx(` Your CPF OA runs dry at age ${p.data.oaRunOutAge}.`));
      } else {
        toks.push(
          tx(" Your CPF OA still has "),
          tx(fmtMoney(p.data.oaLeftAtTransfer), "bold"),
          tx(` left, which transfers to your investments at age ${p.oaTransferAge}.`)
        );
      }
      toks.push(tx(` The mortgage is fully paid off by age ${p.data.mortgagePayoffAge}.`));
    } else {
      toks.push(
        tx("No BTO mortgage is modelled. Your CPF Ordinary Account has "),
        tx(fmtMoney(p.data.oaLeftAtTransfer), "bold"),
        tx(` left, which transfers to your investments at age ${p.oaTransferAge}.`)
      );
    }

    toks.push(
      BR,
      tx(`At age ${p.cpfWithdrawalAge}, an estimated `),
      tx(fmtMoney(p.data.cpfLifePremium), "bold"),
      tx(" from your Retirement Account goes into your CPF LIFE annuity, giving you about "),
      tx(fmtMoney(p.data.cpfLifeMonthly), "bold"),
      tx(`/month from ages ${p.cpfWithdrawalAge}–${p.deathAge}.`)
    );

    return toks;
  }

  const expenseRanges = collapseExpenseRanges(
    p.monthlyExpenseSeries,
    p.monthlyExpensesToday,
    p.currentAge,
    p.stopWorkingAge,
    p.monthlyExpensesRetirement,
    p.deathAge,
  );

  const toks: Tok[] = [
    tx("Way to go! "),
    BR,
    ...expenseRangeToks(expenseRanges),
    tx(fmtMoney(p.data.avgInvested), "bold"),
    tx(" on average each year into your investments, yielding an impressive "),
    tx(fmtMoney(p.retirementBrokerageBalance), "bold-emerald"),
    tx(` investment net worth at retirement (age ${p.stopWorkingAge}). You'll then draw this down over ages ${p.stopWorkingAge} to ${p.deathAge}, leaving `),
    tx(fmtMoney(p.data.leftoverAtDeath), "bold"),
    tx(" at the end."),
    BR,
    tx(`Your investments will peak at age ${p.peakBrokerageAge} at `),
    tx(fmtMoney(p.peakBrokerageBalance), "bold-emerald"),
    tx("."),
    BR,
  ];

  if (p.data.hasBto) {
    if (p.data.mortgageNeedsWithdrawal) {
      toks.push(
        tx("Your CPF Ordinary Account can't fully cover the BTO mortgage — you'll need to top up "),
        tx(fmtMoney(p.data.mortgageCashTotal), "bold"),
        tx(" from cash and investments over the loan.")
      );
    } else {
      toks.push(tx("You'll pay off your BTO mortgage entirely from your CPF Ordinary Account — no need to dip into cash or investments."));
    }
    if (p.data.oaRunOutAge !== undefined) {
      toks.push(tx(` Your CPF OA runs dry at age ${p.data.oaRunOutAge}.`));
    } else {
      toks.push(
        tx(" Your CPF OA still has "),
        tx(fmtMoney(p.data.oaLeftAtTransfer), "bold"),
        tx(` left, which transfers to your investments at age ${p.oaTransferAge}.`)
      );
    }
    toks.push(tx(` The mortgage is fully paid off by age ${p.data.mortgagePayoffAge}.`));
  } else {
    toks.push(
      tx("No BTO mortgage is modelled. Your CPF Ordinary Account has "),
      tx(fmtMoney(p.data.oaLeftAtTransfer), "bold"),
      tx(` left, which transfers to your investments at age ${p.oaTransferAge}.`)
    );
  }

  toks.push(
    BR,
    tx(`At age ${p.cpfWithdrawalAge}, an estimated `),
    tx(fmtMoney(p.data.cpfLifePremium), "bold"),
    tx(" from your Retirement Account goes into your CPF LIFE annuity, giving you about "),
    tx(fmtMoney(p.data.cpfLifeMonthly), "bold-emerald"),
    tx(`/month from ages ${p.cpfWithdrawalAge}–${p.deathAge}.`)
  );

  return toks;
}

function countChars(tokens: Tok[]): number {
  return tokens.reduce((n, tok) => {
    if (tok.kind === "text") return n + tok.text.length;
    if (tok.kind === "list") return n + tok.items.reduce((s, item) => s + item.length, 0);
    return n;
  }, 0);
}

function applyStyle(style: Style, content: string, key: string | number) {
  if (style === "bold") return <strong key={key}>{content}</strong>;
  if (style === "bold-emerald")
    return <strong key={key} className="text-emerald-600 dark:text-emerald-400">{content}</strong>;
  if (style === "bold-red")
    return <strong key={key} className="text-red-600 dark:text-red-400">{content}</strong>;
  return <span key={key}>{content}</span>;
}

const Cursor = () => (
  <span
    className="inline-block w-px bg-current align-text-bottom animate-pulse ml-px"
    style={{ height: "0.9em" }}
    aria-hidden
  />
);

function renderStream(
  paragraphs: Paragraph[],
  revealed: number,
  done: boolean,
  canRetire: boolean
): React.ReactNode {
  let rem = revealed;
  let cursorPlaced = false;

  return paragraphs.map((para, pi) => {
    if (para.kind === "list") {
      const liNodes: React.ReactNode[] = [];
      for (let itemIdx = 0; itemIdx < para.items.length; itemIdx++) {
        const item = para.items[itemIdx];
        if (rem <= 0) {
          liNodes.push(
            <li key={itemIdx} className="opacity-0 select-none" aria-hidden>{item}</li>
          );
        } else if (rem >= item.length) {
          rem -= item.length;
          liNodes.push(<li key={itemIdx}>{item}</li>);
          if (rem === 0 && !cursorPlaced && !done) {
            cursorPlaced = true;
          }
        } else {
          const visible = item.slice(0, rem);
          const hidden = item.slice(rem);
          liNodes.push(
            <li key={itemIdx}>
              {visible}
              {!cursorPlaced && !done && <Cursor />}
              <span className="opacity-0 select-none" aria-hidden>{hidden}</span>
            </li>
          );
          cursorPlaced = true;
          rem = 0;
        }
      }
      return (
        <ol key={pi} className="list-decimal list-outside ml-4 space-y-1 text-sm text-foreground/85 dark:text-foreground/70 leading-relaxed">
          {liNodes}
        </ol>
      );
    }

    const isAccent = canRetire && pi === 0;
    const isFailureAccent = !canRetire && pi === 0;
    const nodes: React.ReactNode[] = [];

    for (let ti = 0; ti < para.toks.length; ti++) {
      const tok = para.toks[ti];
      const { text, style } = tok;

      if (rem <= 0) {
        nodes.push(
          <span key={ti} className="opacity-0 select-none" aria-hidden>
            {applyStyle(style, text, ti)}
          </span>
        );
      } else if (rem >= text.length) {
        rem -= text.length;
        nodes.push(applyStyle(style, text, ti));
        if (rem === 0 && !cursorPlaced && !done) {
          nodes.push(<Cursor key="cur" />);
          cursorPlaced = true;
        }
      } else {
        const visible = text.slice(0, rem);
        const hidden = text.slice(rem);
        nodes.push(
          <span key={ti}>
            {applyStyle(style, visible, `${ti}v`)}
            {!cursorPlaced && !done && <Cursor key="cur" />}
            <span className="opacity-0 select-none" aria-hidden>
              {applyStyle(style, hidden, `${ti}h`)}
            </span>
          </span>
        );
        cursorPlaced = true;
        rem = 0;
      }
    }

    return (
      <p
        key={pi}
        className={
          isAccent
            ? "text-base font-semibold text-emerald-600 dark:text-emerald-400"
            : isFailureAccent
            ? "text-base font-semibold text-red-600 dark:text-red-400"
            : "text-sm text-foreground/85 dark:text-foreground/70 leading-relaxed"
        }
      >
        {nodes}
      </p>
    );
  });
}

const CHARS_PER_TICK = 3;
const TICK_MS = 16;

export default function SmartSummary(props: Props) {
  const { open, targetWidth, canRetire, generationKey } = props;

  const tokens = useMemo(
    () => buildTokens(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.canRetire, props.stopWorkingAge, props.runOutAge, props.currentAge,
      props.deathAge, props.monthlyExpensesToday, props.monthlyExpensesRetirement,
      props.monthlyExpenseSeries, props.retirementBrokerageBalance,
      props.peakBrokerageBalance, props.peakBrokerageAge,
      props.oaTransferAge, props.cpfWithdrawalAge, props.data,
    ]
  );

  const paragraphs = useMemo<Paragraph[]>(() => {
    const groups: Paragraph[] = [];
    let current: (Tok & { kind: "text" })[] = [];

    for (const tok of tokens) {
      if (tok.kind === "break") {
        if (current.length > 0) {
          groups.push({ kind: "text", toks: current });
          current = [];
        }
      } else if (tok.kind === "list") {
        if (current.length > 0) {
          groups.push({ kind: "text", toks: current });
          current = [];
        }
        groups.push({ kind: "list", items: tok.items });
      } else {
        current.push(tok);
      }
    }
    if (current.length > 0) groups.push({ kind: "text", toks: current });
    return groups;
  }, [tokens]);

  const total = useMemo(() => countChars(tokens), [tokens]);

  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!open) {
      setRevealed(0);
      return;
    }
    let count = 0;
    setRevealed(0);
    timerRef.current = setInterval(() => {
      count += CHARS_PER_TICK;
      if (count >= total) {
        setRevealed(total);
        clearInterval(timerRef.current!);
        timerRef.current = null;
      } else {
        setRevealed(count);
      }
    }, TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // generationKey restarts the animation whenever Recalculate is pressed on any page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total, generationKey]);

  const done = revealed >= total;

  if (props.embedded) {
    return (
      <div className="space-y-3">
        {renderStream(paragraphs, revealed, done, canRetire)}
      </div>
    );
  }

  return (
    <div
      className="shrink-0 overflow-hidden transition-[width,margin-left] duration-300 ease-in-out"
      style={{
        width: open ? "calc(50% - 8px)" : "0px",
        marginLeft: open ? "16px" : "0px",
        height: open ? "auto" : 0,
      }}
      aria-hidden={!open}
    >
      <div
        className="glass-card p-5"
        style={{ minWidth: targetWidth > 0 ? targetWidth : undefined }}
      >
        <div className="space-y-3">
          {renderStream(paragraphs, revealed, done, canRetire)}
        </div>
      </div>
    </div>
  );
}
