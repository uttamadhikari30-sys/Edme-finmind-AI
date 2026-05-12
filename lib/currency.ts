"use client";

import { useEffect, useState } from "react";

export type Currency = {
  code: string;
  symbol: string;
  rate: number;
};

export type Unit = "actual" | "lakhs" | "crores" | "millions";

export const CURRENCIES: Record<string, Currency> = {
  INR: { code: "INR", symbol: "₹",  rate: 1.0 },
  USD: { code: "USD", symbol: "$",  rate: 0.012 },
  AED: { code: "AED", symbol: "د.إ", rate: 0.044 },
  GBP: { code: "GBP", symbol: "£",  rate: 0.0095 },
  SGD: { code: "SGD", symbol: "S$", rate: 0.016 },
};

const UNIT_DIVISOR: Record<Unit, number> = {
  actual: 1,
  lakhs: 1e5,
  crores: 1e7,
  millions: 1e6,
};

const UNIT_SUFFIX: Record<Unit, string> = {
  actual: "",
  lakhs: "L",
  crores: "Cr",
  millions: "M",
};

const UNIT_DECIMALS: Record<Unit, number> = {
  actual: 0,
  lakhs: 2,
  crores: 2,
  millions: 1,
};

export function getCurrencyFromStorage(): Currency {
  if (typeof window === "undefined") return CURRENCIES.INR!;
  const code = localStorage.getItem("fm_currency") ?? "INR";
  return CURRENCIES[code] ?? CURRENCIES.INR!;
}

export function getUnitFromStorage(): Unit {
  if (typeof window === "undefined") return "lakhs";
  const u = localStorage.getItem("fm_unit") as Unit | null;
  return u ?? "lakhs";
}

/** Hook: live currency, re-renders on currency OR unit changes (so callers re-format). */
export function useCurrency(): Currency {
  const [cur, setCur] = useState<Currency>(CURRENCIES.INR!);
  useEffect(() => {
    setCur(getCurrencyFromStorage());
    const onCur = (e: Event) => setCur(CURRENCIES[(e as CustomEvent<string>).detail] ?? CURRENCIES.INR!);
    const onUnit = () => setCur((c) => ({ ...c })); // force re-render
    window.addEventListener("fm-currency-change", onCur);
    window.addEventListener("fm-unit-change", onUnit);
    return () => {
      window.removeEventListener("fm-currency-change", onCur);
      window.removeEventListener("fm-unit-change", onUnit);
    };
  }, []);
  return cur;
}

/** Hook: live unit (Actual/Lakhs/Crores/Millions). */
export function useUnit(): Unit {
  const [unit, setUnit] = useState<Unit>("lakhs");
  useEffect(() => {
    setUnit(getUnitFromStorage());
    const onChange = (e: Event) => setUnit(((e as CustomEvent<string>).detail as Unit) ?? "lakhs");
    window.addEventListener("fm-unit-change", onChange);
    return () => window.removeEventListener("fm-unit-change", onChange);
  }, []);
  return unit;
}

/** Format an INR value in the selected currency + selected unit. Reads unit from localStorage. */
export function formatCurrencyLakhs(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const unit = getUnitFromStorage();
  const converted = inrValue * currency.rate;
  const divisor = UNIT_DIVISOR[unit];
  const suffix = UNIT_SUFFIX[unit];
  const decimals = UNIT_DECIMALS[unit];
  const formatted = (converted / divisor).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currency.symbol}${formatted}${suffix ? " " + suffix : ""}`;
}

export function formatCurrency(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const converted = inrValue * currency.rate;
  if (Math.abs(converted) >= 1e7) return `${currency.symbol}${(converted / 1e7).toFixed(2)} Cr`;
  if (Math.abs(converted) >= 1e5) return `${currency.symbol}${(converted / 1e5).toFixed(2)} L`;
  if (Math.abs(converted) >= 1e3) return `${currency.symbol}${(converted / 1e3).toFixed(1)} K`;
  return `${currency.symbol}${converted.toFixed(0)}`;
}

/** Compact display of value in current unit, NO currency symbol or suffix (for table cells). */
export function compactLakhs(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const unit = getUnitFromStorage();
  const converted = inrValue * currency.rate;
  const divisor = UNIT_DIVISOR[unit];
  const decimals = UNIT_DECIMALS[unit];
  return (converted / divisor).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
