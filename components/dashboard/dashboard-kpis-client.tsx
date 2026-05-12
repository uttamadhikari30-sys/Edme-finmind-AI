"use client";

import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Tone = "navy" | "red" | "green" | "gold" | "purple";

export type DashKpi = {
  label: string;
  inrValue: number;
  rawDisplay?: string;
  isPercentage?: boolean;
  delta?: { value: number; tone: "up" | "down" | "flat" };
  sub?: string;
  tone: Tone;
  emoji?: string;
};

const TONE_BG: Record<Tone, string> = {
  navy:   "from-navy-50/40 to-white",
  red:    "from-edred-50/50 to-white",
  green:  "from-edgreen-50/50 to-white",
  gold:   "from-gold-50/60 to-white",
  purple: "from-edpurple-50/50 to-white",
};

const TONE_TEXT: Record<Tone, string> = {
  navy:   "text-navy",
  red:    "text-edred",
  green:  "text-edgreen",
  gold:   "text-gold",
  purple: "text-edpurple",
};

const TONE_ACCENT: Record<Tone, string> = {
  navy:   "bg-gradient-to-r from-navy to-navy-500",
  red:    "bg-gradient-to-r from-edred to-pink-500",
  green:  "bg-gradient-to-r from-edgreen to-emerald-400",
  gold:   "bg-gradient-to-r from-gold to-amber-400",
  purple: "bg-gradient-to-r from-edpurple to-violet-400",
};

export default function DashboardKpisClient({ kpis }: { kpis: DashKpi[] }) {
  const currency = useCurrency();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-5">
      {kpis.map((k, i) => {
        const display = k.rawDisplay
          ? k.rawDisplay
          : k.isPercentage
          ? compactLakhs(k.inrValue, currency)
          : formatCurrencyLakhs(k.inrValue, currency);
        return (
          <div
            key={i}
            className={cn(
              "relative rounded-2xl border border-[var(--border)] overflow-hidden",
              "bg-gradient-to-br shadow-soft hover:shadow-card transition-all duration-200",
              "hover:-translate-y-1 group",
              TONE_BG[k.tone]
            )}
          >
            {/* Top gradient accent */}
            <div className={cn("absolute top-0 left-0 right-0 h-1", TONE_ACCENT[k.tone])} />

            {/* Watermark emoji */}
            {k.emoji && (
              <div
                className="absolute -right-2 -bottom-3 text-[80px] opacity-[0.06] pointer-events-none leading-none select-none group-hover:opacity-[0.10] transition-opacity"
              >
                {k.emoji}
              </div>
            )}

            <div className="relative p-5">
              <div className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-ink-subtle mb-3">
                {k.label}
              </div>

              <div
                className={cn(
                  "font-mono font-bold leading-[1] text-[28px] md:text-[30px]",
                  TONE_TEXT[k.tone]
                )}
                style={{ letterSpacing: "-0.02em" }}
              >
                {display}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap min-h-[20px]">
                {k.delta && (
                  <span
                    className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-sm",
                      k.delta.tone === "down"
                        ? "bg-edred text-white"
                        : k.delta.tone === "flat"
                        ? "bg-gold text-white"
                        : "bg-edgreen text-white"
                    )}
                  >
                    {k.delta.tone === "down" ? "▼" : k.delta.tone === "flat" ? "▶" : "▲"}{" "}
                    {Math.abs(k.delta.value).toFixed(1)}%
                  </span>
                )}
                {k.sub && <span className="text-[10.5px] text-ink-subtle">{k.sub}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
