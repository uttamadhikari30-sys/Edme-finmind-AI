"use client";

import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Tone = "navy" | "red" | "green" | "gold" | "purple";

export type DashKpi = {
  label: string;
  inrValue: number;          // base INR amount
  rawDisplay?: string;       // override formatting (e.g. "—" or "%")
  isPercentage?: boolean;
  delta?: { value: number; tone: "up" | "down" | "flat" };
  sub?: string;
  tone: Tone;
  emoji?: string;
};

export default function DashboardKpisClient({ kpis }: { kpis: DashKpi[] }) {
  const currency = useCurrency();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-4">
      {kpis.map((k, i) => {
        const display = k.rawDisplay
          ? k.rawDisplay
          : k.isPercentage
          ? compactLakhs(k.inrValue, currency)  // percentages don't convert
          : formatCurrencyLakhs(k.inrValue, currency);
        return (
          <div
            key={i}
            className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all"
          >
            <div className={cn("kpi-accent", k.tone)} />
            {k.emoji && (
              <div className="absolute right-3 bottom-3 text-[44px] opacity-[0.07] pointer-events-none leading-none select-none">
                {k.emoji}
              </div>
            )}
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-subtle mb-2">
              {k.label}
            </div>
            <div
              className={cn(
                "font-mono text-[26px] font-semibold leading-none",
                k.tone === "green"
                  ? "text-edgreen"
                  : k.tone === "red"
                  ? "text-edred"
                  : k.tone === "gold"
                  ? "text-gold"
                  : k.tone === "purple"
                  ? "text-edpurple"
                  : "text-navy"
              )}
            >
              {display}
            </div>
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {k.delta && (
                <span
                  className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1",
                    k.delta.tone === "down"
                      ? "bg-edred-50 text-edred"
                      : k.delta.tone === "flat"
                      ? "bg-gold-50 text-gold"
                      : "bg-edgreen-50 text-edgreen"
                  )}
                >
                  {k.delta.tone === "down" ? "▼" : k.delta.tone === "flat" ? "▶" : "▲"}{" "}
                  {Math.abs(k.delta.value).toFixed(1)}%
                </span>
              )}
              {k.sub && <span className="text-[10.5px] text-ink-subtle">{k.sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
