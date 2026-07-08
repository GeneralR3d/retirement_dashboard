"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import FeedbackWidget from "./feedback-widget";

const PLANNER_ROUTES = ["/main", "/accumulation", "/retirement", "/cpf", "/bto"];

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
      className={`px-3 py-1.5 rounded-full text-sm font-normal transition-colors ${
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

  return (
    <nav className="relative z-40 shrink-0 h-14 flex items-center gap-6 px-5 border-b border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-2xl">
      <Link href="/" className="shrink-0">
        <Image
          src="/logo light.png"
          alt="Retirement.sg"
          width={120}
          height={30}
          className="dark:hidden"
          priority
        />
        <Image
          src="/logo dark.png"
          alt="Retirement.sg"
          width={120}
          height={30}
          className="hidden dark:block"
          priority
        />
      </Link>

      <div className="flex items-center gap-1">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {SECONDARY_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
        <FeedbackWidget />
        <button
          onClick={toggle}
          className="ml-2 rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium hover:bg-white/50 dark:hover:bg-white/10 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </nav>
  );
}
