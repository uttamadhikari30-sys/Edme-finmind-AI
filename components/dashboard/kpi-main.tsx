import { cn, formatPct } from "@/lib/utils";

type Tone = "navy" | "red" | "green" | "gold" | "purple";

export type MainKpi = {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: number; tone?: "up" | "down" | "flat" };
  sub?: string;
  tone: Tone;
  emoji?: string;
};

export default function KpiMain({ kpis }: { kpis: MainKpi[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-4">
      {kpis.map((k, i) => (
        <Card key={i} kpi={k} />
      ))}
    </div>
  );
}

function Card({ kpi }: { kpi: MainKpi }) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={cn("kpi-accent", kpi.tone)} />
      {kpi.emoji && (
        <div className="absolute right-3 bottom-3 text-[44px] opacity-[0.07] pointer-events-none leading-none select-none">
          {kpi.emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-subtle mb-2">
        {kpi.label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-[26px] font-semibold leading-none",
            kpi.tone === "green"
              ? "text-edgreen"
              : kpi.tone === "red"
              ? "text-edred"
              : kpi.tone === "gold"
              ? "text-gold"
              : kpi.tone === "purple"
              ? "text-edpurple"
              : "text-navy"
          )}
        >
          {kpi.value}
        </span>
        {kpi.unit && <span className="text-[11px] font-semibold text-ink-subtle">{kpi.unit}</span>}
      </div>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {kpi.delta && (
          <span
            className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1",
              kpi.delta.tone === "down"
                ? "bg-edred-50 text-edred"
                : kpi.delta.tone === "flat"
                ? "bg-gold-50 text-gold"
                : "bg-edgreen-50 text-edgreen"
            )}
          >
            {kpi.delta.tone === "down" ? "▼" : kpi.delta.tone === "flat" ? "▶" : "▲"}{" "}
            {formatPct(Math.abs(kpi.delta.value), 1)}
          </span>
        )}
        {kpi.sub && <span className="text-[10.5px] text-ink-subtle">{kpi.sub}</span>}
      </div>
    </div>
  );
}
