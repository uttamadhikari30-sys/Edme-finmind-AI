"use client";

import { useEffect, useState } from "react";

export type Currency = {
  code: string;
  symbol: string;
  rate: number; // multiply INR amount by this rate to get target currency
};

// FX rates from INR base. Updated 2026-05.
export const CURRENCIES: Record<string, Currency> = {
  INR: { code: "INR", symbol: "₹",  rate: 1.0 },
  USD: { code: "USD", symbol: "$",  rate: 0.012 },
  AED: { code: "AED", symbol: "د.إ", rate: 0.044 },
  GBP: { code: "GBP", symbol: "£",  rate: 0.0095 },
  SGD: { code: "SGD", symbol: "S$", rate: 0.016 },
};

export function getCurrencyFromStorage(): Currency {
  if (typeof window === "undefined") return CURRENCIES.INR!;
  const code = localStorage.getItem("fm_currency") ?? "INR";
  return CURRENCIES[code] ?? CURRENCIES.INR!;
}

/** Hook that returns the live currency, re-rendering when user picks a new one */
export function useCurrency(): Currency {
  const [cur, setCur] = useState<Currency>(CURRENCIES.INR!);
  useEffect(() => {
    setCur(getCurrencyFromStorage());
    const onChange = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      setCur(CURRENCIES[code] ?? CURRENCIES.INR!);
    };
    window.addEventListener("fm-currency-change", onChange);
    return () => window.removeEventListener("fm-currency-change", onChange);
  }, []);
  return cur;
}

/** Format an INR base amount in the selected currency, with Lakhs suffix. */
export function formatCurrencyLakhs(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const converted = inrValue * currency.rate;
  return `${currency.symbol}${(converted / 1e5).toFixed(2)} L`;
}

/** Format an INR base amount in selected currency in its native units (no Lakhs scaling) */
export function formatCurrency(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const converted = inrValue * currency.rate;
  if (Math.abs(converted) >= 1e7) return `${currency.symbol}${(converted / 1e7).toFixed(2)} Cr`;
  if (Math.abs(converted) >= 1e5) return `${currency.symbol}${(converted / 1e5).toFixed(2)} L`;
  if (Math.abs(converted) >= 1e3) return `${currency.symbol}${(converted / 1e3).toFixed(1)} K`;
  return `${currency.symbol}${converted.toFixed(0)}`;
}

/** Format compact: e.g., "245" (in lakhs scale, no symbol/suffix) */
export function compactLakhs(inrValue: number, currency: Currency = CURRENCIES.INR!): string {
  if (inrValue == null || isNaN(inrValue)) return "—";
  const converted = inrValue * currency.rate;
  return (converted / 1e5).toFixed(0);
}
