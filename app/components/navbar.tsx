"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LineChart } from "lucide-react";
import FeedbackWidget from "./feedback-widget";

const PLANNER_ROUTES = ["/main", "/accumulation", "/retirement", "/cpf", "/bto", "/inputs"];

const PRIMARY_LINKS = [{ href: "/main", label: "Planner" }];

const SECONDARY_LINKS = [
  { href: "/srs", label: "SRS Demo" },
  { href: "/about", label: "Support Us" },
];

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const stored =
      (typeof window !== "undefined" &&
        (localStorage.getItem("theme") as "dark" | "light" | null)) ||
      "light";
    setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active =
    href === "/main"
      ? PLANNER_ROUTES.includes(pathname) || pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-normal transition-colors ${
        active
          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
          : "text-foreground/70 hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const plannerActive = PLANNER_ROUTES.includes(pathname) || pathname === "/";

  return (
    <nav className="relative z-40 shrink-0 h-14 flex items-center gap-2 sm:gap-6 px-2.5 sm:px-5 border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-2xl">
      <Link href="/" className="shrink-0">
        <Image
          src="/logo light.png"
          alt="Retirement.sg"
          width={120}
          height={30}
          className="dark:hidden w-20 sm:w-[120px] h-auto"
          priority
        />
        <Image
          src="/logo dark.png"
          alt="Retirement.sg"
          width={120}
          height={30}
          className="hidden dark:block w-20 sm:w-[120px] h-auto"
          priority
        />
      </Link>

      {/* Mobile: icon-only Planner link (the text link doesn't fit) */}
      <Link
        href="/main"
        aria-label="Planner"
        className={`sm:hidden shrink-0 flex items-center justify-center rounded-full p-1.5 transition-colors ${
          plannerActive
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
            : "text-foreground/70 hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
        }`}
      >
        <LineChart size={16} strokeWidth={2} aria-hidden="true" />
      </Link>

      <div className="hidden sm:flex items-center gap-1">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        {SECONDARY_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
        <FeedbackWidget />
        <button
          onClick={toggle}
          className="ml-1 sm:ml-2 shrink-0 rounded-full border border-foreground/15 px-2 sm:px-3 py-1 text-xs font-medium hover:bg-white/50 dark:hover:bg-white/10 transition"
          aria-label="Toggle theme"
        >
          <span className="sm:hidden">{theme === "dark" ? "☀" : "☾"}</span>
          <span className="hidden sm:inline">{theme === "dark" ? "☀ Light" : "☾ Dark"}</span>
        </button>
      </div>
    </nav>
  );
}
