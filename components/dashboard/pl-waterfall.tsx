"use client";

import { formatINRUnit } from "@/lib/utils";

type Row = {
  label: string;
  value: number;
  pct?: number;
  tone: "navy" | "red" | "green" | "gold" | "purple";
  isTotal?: boolean;
};

export default function PLWaterfall({ rows, periodLabel }: { rows: Row[]; periodLabel: string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  const toneCls: Record<string, string> = {
    navy: "bg-navy",
    red: "bg-edred",
    green: "bg-edgreen",
    gold: "bg-gold",
    purple: "bg-edpurple",
  };
  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">P&amp;L Waterfall</h3>
        <span className="text-[11px] text-ink-subtle">{periodLabel}</span>
      </div>
      <div className="p-5 space-y-2.5">
        {rows.map((r, i) => {
          const widthPct = (Math.abs(r.value) / max) * 100;
          return (
            <div key={i} className="grid grid-cols-12 items-center gap-3">
              <div
                className={`col-span-3 text-[12px] font-semibold ${
                  r.isTotal ? "text-navy" : "text-ink-muted"
                }`}
              >
                {r.label}
              </div>
              <div className="col-span-6 h-6 bg-navy-50/40 rounded relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${toneCls[r.tone]} rounded transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div
                className={`col-span-2 text-right font-mono text-[12px] ${
                  r.tone === "red" ? "text-edred" : r.tone === "green" ? "text-edgreen" : "text-navy"
                } font-semibold`}
              >
                {r.value < 0 ? "-" : ""}
                {formatINRUnit(Math.abs(r.value))}
              </div>
              <div className="col-span-1 text-right text-[10.5px] text-ink-subtle font-mono">
                {r.pct != null ? `${r.pct.toFixed(1)}%` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
