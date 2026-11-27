import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type Seg = { label: string; value: number };

const PALETTE = ["#1C3687", "#00875a", "#0891b2", "#d68910", "#6c3483", "#e67e22", "#c0392b", "#647194", "#16a085"];
const L = (v: number) => `₹${(v / 1e5).toFixed(1)}L`;

// Revenue mix by line of business — ported from the v8 artifact segment mix.
export default function SegmentMix({ title = "🏛 Product Mix", rows }: { title?: string; rows: Seg[] }) {
  const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const tot = sorted.reduce((s, r) => s + r.value, 0);
  if (!tot) return null;

  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="px-4 py-3">
        {sorted.map((s, i) => {
          const p = (s.value / tot) * 100;
          const c = PALETTE[i % PALETTE.length];
          return (
            <div key={s.label} className="mb-2.5">
              <div className="flex justify-between mb-1">
                <span className="text-[11px] font-semibold text-navy flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                  {s.label}
                </span>
                <span className="font-mono text-[11px] font-bold" style={{ color: c }}>{L(s.value)}</span>
              </div>
              <div className="h-[18px] rounded-md bg-bg-alt overflow-hidden relative">
                <div className="h-full rounded-md" style={{ width: `${p}%`, background: c, opacity: 0.82 }} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: c }}>
                  {p.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
