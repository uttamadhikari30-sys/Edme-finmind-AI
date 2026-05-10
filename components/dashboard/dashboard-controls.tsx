"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Drill = "ftm" | "ytd" | "mom";
type Unit = "actual" | "lakhs" | "crores" | "millions";

export default function DashboardControls({
  periodLabel,
  initialUnit = "lakhs",
  onUnitChange,
  onDrillChange,
}: {
  periodLabel: string;
  initialUnit?: Unit;
  onUnitChange?: (u: Unit) => void;
  onDrillChange?: (d: Drill) => void;
}) {
  const [drill, setDrill] = useState<Drill>("ftm");
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [view, setView] = useState<"actual" | "aop" | "py" | "le">("aop");

  function pickUnit(u: Unit) {
    setUnit(u);
    onUnitChange?.(u);
  }
  function pickDrill(d: Drill) {
    setDrill(d);
    onDrillChange?.(d);
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Top row: unit toggle + action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-navy hover:text-navy">
          🌐 FX <span className="text-navy ml-1">IN INR ₹</span>
        </button>
        <span className="text-[11px] text-ink-subtle font-bold">₹ VIEW</span>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-alt border border-[var(--border)]">
          {(["actual", "lakhs", "crores", "millions"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => pickUnit(u)}
              className={cn(
                "px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition",
                unit === u ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
              )}
            >
              {u}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-edgreen hover:text-edgreen flex items-center gap-1.5">
          📊 Excel
        </button>
        <button className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-edred hover:text-edred flex items-center gap-1.5">
          📄 PDF
        </button>
        <button className="px-3.5 py-1.5 rounded-lg bg-edred text-white text-[11.5px] font-semibold hover:bg-edred-600 flex items-center gap-1.5 shadow-soft">
          🔒 Freeze MIS
        </button>
      </div>

      {/* Drill row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-navy text-white">
          {(["ftm", "ytd", "mom"] as Drill[]).map((d) => (
            <button
              key={d}
              onClick={() => pickDrill(d)}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-[11.5px] font-semibold uppercase transition",
                drill === d ? "bg-white text-navy" : "text-white/65 hover:text-white"
              )}
            >
              {d === "ftm" ? "FTM" : d === "ytd" ? "YTD" : "📅 MoM Drill ↓"}
            </button>
          ))}
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-navy-50/60 text-[11.5px] text-navy font-semibold">
          For the Month · {periodLabel}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle font-bold">View</span>
          <span className="text-[12px] font-semibold text-navy">Company — Consolidated</span>
          <span className="text-ink-subtle text-[10px]">▾</span>
        </div>
        <div className="flex-1" />
        {(["aop", "py", "le"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[11.5px] font-semibold uppercase transition",
              view === v
                ? "bg-navy text-white shadow-soft"
                : "bg-white border border-[var(--border)] text-ink-muted hover:border-navy hover:text-navy"
            )}
          >
            vs {v.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2 px-3 py-1 text-[11.5px] font-semibold text-edgreen">
          <span className="w-2 h-2 rounded-full bg-edgreen animate-blink" />
          Live · {periodLabel}
        </div>
      </div>
    </div>
  );
}
