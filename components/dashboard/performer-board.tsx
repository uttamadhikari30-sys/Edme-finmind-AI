import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type ScoreRow = {
  bu_id: string;
  bu_code: string;
  bu_name: string;
  actual_revenue: number | string;
  aop_revenue: number | string;
  actual_profit: number | string;
  rev_attainment_pct: number | string;
};

const L = (v: number | string) => `₹${(Number(v) / 1e5).toFixed(1)}L`;

function Row({ r, rank, tone }: { r: ScoreRow; rank: number; tone: "top" | "bottom" }) {
  const pct = Number(r.rev_attainment_pct);
  const good = tone === "top";
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-alt transition">
      <span
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          good ? "bg-edgreen-50 text-edgreen" : "bg-edred-50 text-edred"
        }`}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink truncate">{r.bu_name}</div>
        <div className="text-[10.5px] text-ink-subtle">
          Rev {L(r.actual_revenue)} · Profit {L(r.actual_profit)}
        </div>
      </div>
      <span
        className={`font-mono text-[13px] font-bold ${
          pct >= 100 ? "text-edgreen" : pct >= 95 ? "text-gold" : "text-edred"
        }`}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default function PerformerBoard({ top, bottom }: { top: ScoreRow[]; bottom: ScoreRow[] }) {
  if (!top.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <Card>
        <CardHeader title="🏆 Top 5 Achievers" tag={{ label: "vs AOP", tone: "green" }} />
        <CardBody className="p-2">
          {top.map((r, i) => (
            <Row key={r.bu_id} r={r} rank={i + 1} tone="top" />
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="⚠️ Bottom 5 — Behind Target" tag={{ label: "vs AOP", tone: "red" }} />
        <CardBody className="p-2">
          {bottom.map((r, i) => (
            <Row key={r.bu_id} r={r} rank={i + 1} tone="bottom" />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
