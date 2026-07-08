"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, TrendingUp, Sunset, Landmark, Home } from "lucide-react";

export const PLANNER_TABS = [
  { href: "/main", label: "Networth", Icon: LineChart },
  { href: "/accumulation", label: "Accumulation", Icon: TrendingUp },
  { href: "/bto", label: "BTO", Icon: Home },
  { href: "/cpf", label: "CPF", Icon: Landmark },
  { href: "/retirement", label: "Retirement", Icon: Sunset },
];

export default function PlannerTabs() {
  const pathname = usePathname();

  return (
    <div className="shrink-0 sticky top-0 z-30 flex justify-center px-4 pt-3 pb-1 pointer-events-none">
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
