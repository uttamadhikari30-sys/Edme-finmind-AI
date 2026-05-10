import { cn } from "@/lib/utils";

export type SecondaryKpi = {
  label: string;
  value: string;
  sub?: string;
  tone: "navy" | "red" | "green" | "gold" | "purple";
};

export default function KpiSecondary({ kpis }: { kpis: SecondaryKpi[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
      {kpis.map((k, i) => (
        <div
          key={i}
          className="bg-white rounded-[14px] p-4 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all"
        >
          <div className={cn("kpi-accent", k.tone)} />
          <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-subtle mb-1.5">
            {k.label}
          </div>
          <div
            className={cn(
              "font-mono text-[22px] font-semibold leading-none",
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
            {k.value}
          </div>
          {k.sub && <div className="text-[10.5px] text-ink-subtle mt-1.5">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}
