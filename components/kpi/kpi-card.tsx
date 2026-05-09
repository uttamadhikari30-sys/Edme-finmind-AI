import { cn } from "@/lib/utils";

type Tone = "navy" | "red" | "green" | "gold" | "purple";

export default function KpiCard({
  label,
  value,
  delta,
  vs,
  tone = "navy",
  emoji,
}: {
  label: string;
  value: string;
  delta?: { value: string; up?: boolean };
  vs?: string;
  tone?: Tone;
  emoji?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={cn("kpi-accent", tone)} />
      {emoji && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[44px] opacity-[0.05] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle mb-2">
        {label}
      </div>
      <div className={cn(
        "font-mono text-[24px] font-semibold leading-none",
        tone === "green" ? "text-edgreen" :
        tone === "red" ? "text-edred" :
        tone === "gold" ? "text-gold" :
        tone === "purple" ? "text-edpurple" : "text-navy"
      )}>
        {value}
      </div>
      {(delta || vs) && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {delta && (
            <span className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded",
              delta.up === false ? "bg-edred-50 text-edred" : "bg-edgreen-50 text-edgreen"
            )}>
              {delta.up === false ? "▼" : "▲"} {delta.value}
            </span>
          )}
          {vs && <span className="text-[10.5px] text-ink-subtle">{vs}</span>}
        </div>
      )}
    </div>
  );
}
