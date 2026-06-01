"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-black/5 hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm shadow-black/5 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm shadow-black/5 hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

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
