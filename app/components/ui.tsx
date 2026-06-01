"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

export type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  format,
}: SliderProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-foreground/90 dark:text-foreground/80">{label}</span>
        <span className="font-mono text-foreground">
          {format ? format(value) : value}
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}

export type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  disabled?: boolean;
};

export function NumberField({
  label,
  value,
  onChange,
  step = 1000,
  prefix,
  disabled,
}: NumberFieldProps) {
  return (
    <label className={`block ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="block text-sm text-foreground/90 dark:text-foreground/80 mb-1">{label}</span>
      <div className="flex items-center rounded-xl border border-foreground/15 bg-foreground/5 focus-within:border-emerald-500">
        {prefix && (
          <span className="pl-3 text-foreground/85 dark:text-foreground/60 font-mono">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent px-3 py-2 outline-none font-mono"
        />
      </div>
    </label>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
  tooltip,
  tooltipPosition = "top",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald";
  tooltip?: React.ReactNode;
  tooltipPosition?: "top" | "right";
}) {
  return (
    <div className="border border-foreground/10 bg-foreground/[0.03] p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-foreground/85 dark:text-foreground/60">
        {label}
        {tooltip && <InfoTooltip position={tooltipPosition}>{tooltip}</InfoTooltip>}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${accent === "emerald" ? "text-emerald-600 dark:text-emerald-500" : ""}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-foreground/85 dark:text-foreground/60 mt-1">{sub}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="text-xs text-foreground/85 dark:text-foreground/60">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold font-mono ${accent === "emerald" ? "text-emerald-600 dark:text-emerald-500" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export function InfoTooltip({ children, className, position = "top" }: { children: React.ReactNode; className?: string; position?: "top" | "right" }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords(
        position === "right"
          ? { top: rect.top + rect.height / 2 + window.scrollY, left: rect.right + window.scrollX + 8 }
          : { top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX }
      );
    }
    setVisible(true);
  }

  function hide() {
    hideTimer.current = setTimeout(() => setVisible(false), 100);
  }

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const transform = position === "right" ? "translate(0, -50%)" : "translate(-50%, -100%)";

  return (
    <span className="relative inline-flex">
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="flex h-3.5 w-3.5 cursor-default items-center justify-center rounded-full bg-foreground/20 text-[9px] font-bold text-foreground/85 dark:text-foreground/60 select-none"
      >
        i
      </span>
      {visible && createPortal(
        <span
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            transform,
            zIndex: 9999,
          }}
          className={`pointer-events-auto w-64 border border-foreground/10 bg-[var(--tooltip-bg,#0f172a)] p-3 text-xs font-normal text-foreground/90 dark:text-foreground/80 shadow-xl${className ? ` ${className}` : ""}`}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-2 px-2 font-medium whitespace-nowrap">{children}</th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`py-2 px-2 whitespace-nowrap ${className}`}>{children}</td>
  );
}
