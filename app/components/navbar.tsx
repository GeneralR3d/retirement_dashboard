"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS_MAIN = [
  { href: "/config", label: "Calculator" },
  { href: "/main", label: "Networth" },
  { href: "/accumulation", label: "Accumulation CF" },
  { href: "/retirement", label: "Retirement CF" },
];

const NAV_LINKS_SECONDARY = [
  { href: "/cpf", label: "CPF" },
  { href: "/bto", label: "BTO" },
];

const NAV_LINKS_TOOLS = [
  { href: "/srs", label: "SRS Demo" },
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

function NavLink({ href, label, small }: { href: string; label: string; small?: boolean }) {
  const pathname = usePathname();
  const active =
    pathname === href || (pathname === "/" && href === "/config");

  return (
    <Link
      href={href}
      className={`block px-5 transition-colors rounded-full text-foreground dark:text-foreground ${
        small ? "py-2 text-lg font-medium" : "py-3 text-lg font-black"
      } ${
        active
          ? "bg-emerald-600 text-white dark:text-white shadow-md shadow-emerald-600/25"
          : "hover:bg-white/50 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { theme, toggle } = useTheme();

  return (
    <nav className="w-fit min-w-48 h-screen sticky top-0 shrink-0 flex flex-col border-r border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-2xl">
      <div className="px-5 py-7">
        <Image
          src="/logo light.png"
          alt="Retirement.sg"
          width={160}
          height={40}
          className="dark:hidden"
          priority
        />
        <Image
          src="/logo dark.png"
          alt="Retirement.sg"
          width={160}
          height={40}
          className="hidden dark:block"
          priority
        />
      </div>

      <div className="flex-1 flex flex-col px-3 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {NAV_LINKS_MAIN.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        <div className="my-4 border-t border-foreground/10" />

        <div className="flex flex-col gap-0.5">
          {NAV_LINKS_SECONDARY.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        <div className="my-4 border-t border-foreground/10" />

        <div className="flex flex-col gap-0.5">
          {NAV_LINKS_TOOLS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>
      </div>

      <div className="px-3 py-4 border-t border-white/50 dark:border-white/10 flex flex-col gap-2">
        <NavLink href="/about#support" label="Support Us" small />
        <button
          onClick={toggle}
          className="w-full rounded-full border border-foreground/15 px-4 py-2.5 text-sm font-bold uppercase tracking-wider hover:bg-white/50 dark:hover:bg-white/10 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </nav>
  );
}
