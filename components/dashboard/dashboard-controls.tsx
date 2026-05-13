"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import ExportButtons from "@/components/ui/export-buttons";

type Drill = "ftm" | "ytd" | "mom";

export default function DashboardControls({
  periodLabel,
  verticals = [],
}: {
  periodLabel: string;
  verticals?: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [drill, setDrill] = useState<Drill>("ftm");
  const [view, setView] = useState<"actual" | "aop" | "py" | "le">("aop");
  const [vertical, setVertical] = useState("");

  function pickVertical(v: string) {
    setVertical(v);
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (v) params.set("bu", v);
    else params.delete("bu");
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Drill row + comparison toggles + Freeze + Exports */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-navy text-white">
          {(["ftm", "ytd", "mom"] as Drill[]).map((d) => (
            <button
              key={d}
              onClick={() => setDrill(d)}
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
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-[var(--border)] bg-white">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle font-bold">View</span>
          <select
            value={vertical}
            onChange={(e) => pickVertical(e.target.value)}
            className="text-[12px] font-semibold text-navy bg-transparent outline-none cursor-pointer max-w-[200px]"
          >
            <option value="">Company — Consolidated</option>
            {verticals.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} · {v.name}
              </option>
            ))}
          </select>
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

      {/* Live indicator + Export + Freeze on a single row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1 text-[11.5px] font-semibold text-edgreen">
          <span className="w-2 h-2 rounded-full bg-edgreen animate-blink" />
          Live · {periodLabel}
        </div>
        <div className="flex-1" />
        <ExportButtons reportName={`Company Dashboard · ${periodLabel}`} />
        <button className="px-3.5 py-1.5 rounded-lg bg-edred text-white text-[11.5px] font-semibold hover:bg-edred-600 flex items-center gap-1.5 shadow-soft">
          🔒 Freeze MIS
        </button>
      </div>
    </div>
  );
}
