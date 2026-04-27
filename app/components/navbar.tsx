"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/main", label: "Main" },
  { href: "/srs", label: "SRS" },
  { href: "/cpf", label: "CPF" },
  { href: "/withdrawals", label: "Withdrawals" },
  { href: "/settings", label: "Settings" },
];

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored =
      (typeof window !== "undefined" &&
        (localStorage.getItem("theme") as "dark" | "light" | null)) ||
      "dark";
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

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <nav className="border-b border-foreground/10 sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold mr-4 text-foreground/80">
            SG Retirement
          </span>
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (pathname === "/" && link.href === "/main");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-foreground/10 text-foreground font-medium"
                    : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={toggle}
          className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </nav>
  );
}
