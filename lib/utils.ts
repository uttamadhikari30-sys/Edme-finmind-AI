import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CurrencyUnit = "actual" | "lakhs" | "crores" | "millions";

export function formatINR(value: number, opts: { compact?: boolean } = {}) {
  if (value == null || isNaN(value)) return "—";
  if (opts.compact) {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)} K`;
    return `₹${value.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format value into a chosen Indian unit. Returns just the formatted number — caller adds ₹ + unit suffix. */
export function formatUnit(value: number, unit: CurrencyUnit = "lakhs"): string {
  if (value == null || isNaN(value)) return "—";
  switch (unit) {
    case "actual":
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
    case "lakhs":
      return (value / 1e5).toFixed(0);
    case "crores":
      return (value / 1e7).toFixed(2);
    case "millions":
      return (value / 1e6).toFixed(1);
  }
}

export function unitSuffix(unit: CurrencyUnit): string {
  return { actual: "", lakhs: "L", crores: "Cr", millions: "M" }[unit];
}

export function formatINRUnit(value: number, unit: CurrencyUnit = "lakhs") {
  if (value == null || isNaN(value)) return "—";
  return `₹${formatUnit(value, unit)} ${unitSuffix(unit)}`.trim();
}

export function formatNumber(value: number, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPct(value: number, decimals = 1) {
  if (value == null || isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function pct(part: number, whole: number) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export function delta(actual: number, baseline: number) {
  if (!baseline) return 0;
  return ((actual - baseline) / baseline) * 100;
}
