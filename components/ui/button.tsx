"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type HoverSide = "left" | "right" | null;

export function SplitNavButton({ className }: { className?: string }) {
  const [side, setSide] = React.useState<HoverSide>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === "/accumulation" || pathname === "/retirement";

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSide(e.clientX - rect.left < rect.width / 2 ? "left" : "right");
  };

  const handleClick = () => {
    if (side === "left") router.push("/accumulation");
    else if (side === "right") router.push("/retirement");
    else router.push("/cashflow");
  };

  return (
    <button
      className={cn(
        "relative flex items-center justify-center overflow-hidden cursor-pointer",
        "px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-foreground/10 text-foreground font-medium"
          : "text-foreground/60",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setSide(null)}
      onClick={handleClick}
    >
      {/* Left half shade — slides in from the left */}
      <div
        className={cn(
          "absolute left-0 top-0 w-1/2 h-full bg-foreground/10",
          "transition-transform duration-200 ease-in-out",
          side === "left" ? "translate-x-0" : "-translate-x-full",
        )}
      />

      {/* Right half shade — slides in from the right */}
      <div
        className={cn(
          "absolute right-0 top-0 w-1/2 h-full bg-foreground/10",
          "transition-transform duration-200 ease-in-out",
          side === "right" ? "translate-x-0" : "translate-x-full",
        )}
      />

      {/* Text — three labels cross-fade between states */}
      <span className="relative z-10 select-none" style={{ minWidth: "6.5rem", textAlign: "center" }}>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
            isActive ? "text-foreground font-medium" : "text-foreground/60",
            side === null ? "opacity-100" : "opacity-0",
          )}
        >
          Cashflow
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
            "text-foreground font-medium",
            side === "left" ? "opacity-100" : "opacity-0",
          )}
        >
          Accumulation
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
            "text-foreground font-medium",
            side === "right" ? "opacity-100" : "opacity-0",
          )}
        >
          Retirement
        </span>
        {/* Invisible spacer to hold the width of the longest label */}
        <span className="invisible">Accumulation</span>
      </span>
    </button>
  );
}
