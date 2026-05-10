"use client";

import { useEffect, useState } from "react";

const CURRENCIES = [
  { code: "INR", symbol: "₹",  flag: "🇮🇳", name: "INR" },
  { code: "USD", symbol: "$",  flag: "🇺🇸", name: "USD" },
  { code: "AED", symbol: "د.إ", flag: "🇦🇪", name: "AED" },
  { code: "GBP", symbol: "£",  flag: "🇬🇧", name: "GBP" },
  { code: "SGD", symbol: "S$", flag: "🇸🇬", name: "SGD" },
];

export default function CurrencySelector() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("INR");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("fm_currency") : null;
    if (stored) setCode(stored);
  }, []);

  function pick(c: string) {
    setCode(c);
    if (typeof window !== "undefined") {
      localStorage.setItem("fm_currency", c);
      window.dispatchEvent(new CustomEvent("fm-currency-change", { detail: c }));
    }
    setOpen(false);
  }

  const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-bg-alt text-[11.5px] font-semibold text-ink-muted hover:border-navy hover:text-navy transition"
      >
        <span>🌐</span>
        <span className="text-navy font-bold">FX</span>
        <span>IN {cur.code} {cur.symbol}</span>
        <span className="text-ink-subtle">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[var(--border)] bg-white shadow-card z-50 overflow-hidden">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => pick(c.code)}
              className={`w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 hover:bg-navy-50/40 ${
                c.code === code ? "bg-navy text-white hover:bg-navy" : "text-ink"
              }`}
            >
              <span className="text-[10px] uppercase font-bold">{c.code}</span>
              <span>{c.name}</span>
              <span className="ml-auto">{c.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
