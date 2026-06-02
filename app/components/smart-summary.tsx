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
  peakBrokerageBalance: number;
  peakBrokerageAge: number;
  oaTransferAge: number;
  cpfWithdrawalAge: number;
  data: SmartSummaryData;
  targetWidth: number;
};

// --- Token types ---
type Style = "normal" | "bold" | "bold-emerald" | "bold-red";
type Tok = { kind: "text"; style: Style; text: string } | { kind: "break" };

const tx = (text: string, style: Style = "normal"): Tok => ({ kind: "text", style, text });
const BR: Tok = { kind: "break" };

function buildTokens(p: Omit<Props, "open" | "targetWidth">): Tok[] {
  if (!p.canRetire) {
    return [
      tx(`Based on your current plan, retirement at age ${p.stopWorkingAge} is `),
      tx("not successful", "bold-red"),
      tx(` — your investments run out at age ${p.runOutAge}.`),
    ];
  }

  const toks: Tok[] = [
    tx("Way to go! "),
    BR,
    tx("By keeping your monthly expenses at "),
    tx(fmtMoney(p.monthlyExpensesToday), "bold"),
    tx(` from ages ${p.currentAge} to ${p.stopWorkingAge}, and `),
    tx(fmtMoney(p.monthlyExpensesRetirement), "bold"),
    tx(` from ages ${p.stopWorkingAge} to ${p.deathAge}, you'll be able to invest `),
    tx(fmtMoney(p.data.avgInvested), "bold"),
    tx(" on average each year into the stock market, yielding an impressive "),
    tx(fmtMoney(p.peakBrokerageBalance), "bold-emerald"),
    tx(` peak investment net worth (at age ${p.peakBrokerageAge}). You'll then draw this down over ages ${p.stopWorkingAge} to ${p.deathAge}, leaving `),
    tx(fmtMoney(p.data.leftoverAtDeath), "bold"),
    tx(" at the end."),
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
    tx("/month for life.")
  );

  return toks;
}

function countChars(tokens: Tok[]): number {
  return tokens.reduce((n, tok) => n + (tok.kind === "break" ? 0 : tok.text.length), 0);
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
  paragraphs: (Tok & { kind: "text" })[][],
  revealed: number,
  done: boolean,
  canRetire: boolean
): React.ReactNode {
  let rem = revealed;
  let cursorPlaced = false;

  return paragraphs.map((para, pi) => {
    const isAccent = canRetire && pi === 0;
    const nodes: React.ReactNode[] = [];

    for (let ti = 0; ti < para.length; ti++) {
      const tok = para[ti];
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
  const { open, targetWidth, canRetire } = props;

  const tokens = useMemo(
    () => buildTokens(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.canRetire, props.stopWorkingAge, props.runOutAge, props.currentAge,
      props.deathAge, props.monthlyExpensesToday, props.monthlyExpensesRetirement,
      props.peakBrokerageBalance, props.peakBrokerageAge, props.oaTransferAge,
      props.cpfWithdrawalAge, props.data,
    ]
  );

  const paragraphs = useMemo(() => {
    const groups: (Tok & { kind: "text" })[][] = [[]];
    for (const tok of tokens) {
      if (tok.kind === "break") groups.push([]);
      else groups[groups.length - 1].push(tok as Tok & { kind: "text" });
    }
    return groups.filter((g) => g.length > 0);
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
  }, [open, total]);

  const done = revealed >= total;

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
        className="border border-foreground/15 bg-foreground/[0.03] p-5"
        style={{ minWidth: targetWidth > 0 ? targetWidth : undefined }}
      >
        <div className="space-y-3">
          {renderStream(paragraphs, revealed, done, canRetire)}
        </div>
      </div>
    </div>
  );
}
