"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LineChart,
  TrendingUp,
  Sunset,
  Landmark,
  Home,
  SlidersHorizontal,
} from "lucide-react";

export const PLANNER_TABS = [
  { href: "/main", label: "Networth", Icon: LineChart },
  { href: "/accumulation", label: "Accumulation", Icon: TrendingUp },
  { href: "/bto", label: "BTO", Icon: Home },
  { href: "/cpf", label: "CPF", Icon: Landmark },
  { href: "/retirement", label: "Retirement", Icon: Sunset },
];

// Mobile-only tab: on small screens the inputs pane becomes its own page.
export const INPUTS_TAB = { href: "/inputs", label: "Inputs", Icon: SlidersHorizontal };

export default function PlannerTabs({
  variant = "top",
}: {
  variant?: "top" | "bottom";
}) {
  const pathname = usePathname();

  if (variant === "bottom") {
    // Thumb-reachable bottom bar for mobile; hidden on md+ where the top
    // pill and the persistent inputs pane take over.
    return (
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pointer-events-none">
        <nav className="glass-nav pointer-events-auto flex items-stretch gap-0.5 px-1.5 py-1.5 rounded-full w-full max-w-md">
          {[INPUTS_TAB, ...PLANNER_TABS].map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full text-[10px] leading-none transition-colors ${
                  active
                    ? "bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-600/25"
                    : "text-foreground/70 hover:bg-white/60 dark:hover:bg-white/10 hover:text-foreground"
                }`}
              >
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="hidden md:flex shrink-0 sticky top-0 z-30 justify-center px-4 pt-3 pb-1 pointer-events-none">
      <nav className="glass-nav pointer-events-auto flex items-center justify-center gap-1 px-2 py-1 rounded-full">
        {PLANNER_TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                active
                  ? "bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-600/25"
                  : "text-foreground/70 hover:bg-white/60 dark:hover:bg-white/10 hover:text-foreground"
              }`}
            >
              <Icon size={13} strokeWidth={2} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
