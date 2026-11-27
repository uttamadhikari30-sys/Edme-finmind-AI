import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ScoreRow } from "@/components/dashboard/performer-board";

// Color-graded vertical performance heatmap — ported from the v8 dashboard artifact.
function grade(rp: number) {
  if (rp >= 110) return { c: "#6c3483", bg: "rgba(108,52,131,.07)" }; // Stretch
  if (rp >= 100) return { c: "#00875a", bg: "rgba(0,135,90,.07)" };   // Above
  if (rp >= 90) return { c: "#d68910", bg: "rgba(214,137,16,.07)" };  // Target
  if (rp >= 80) return { c: "#e67e22", bg: "rgba(230,126,34,.07)" };  // Near
  return { c: "#c0392b", bg: "rgba(192,57,43,.07)" };                 // Below
}

const L = (v: number) => `₹${(v / 1e5).toFixed(1)}L`;

export default function VerticalHeatmap({ rows }: { rows: ScoreRow[] }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort(
    (a, b) => Number(b.rev_attainment_pct) - Number(a.rev_attainment_pct)
  );

  return (
    <Card className="mb-4">
      <CardHeader
        title="Vertical Performance"
        right={
          <div className="flex gap-3 text-[9px] font-bold flex-wrap">
            <span style={{ color: "#6c3483" }}>■ Stretch</span>
            <span style={{ color: "#00875a" }}>■ Above</span>
            <span style={{ color: "#d68910" }}>■ Target</span>
            <span style={{ color: "#c0392b" }}>■ Below</span>
          </div>
        }
      />
      <CardBody className="px-3 py-3">
        {sorted.map((v) => {
          const rp = Number(v.rev_attainment_pct);
          const g = grade(rp);
          const bar = (Math.min(Math.max(rp, 0), 130) / 130) * 100;
          return (
            <div
              key={v.bu_id}
              className="flex items-center gap-2.5 px-1.5 py-1 mb-0.5 rounded-lg"
              style={{ transition: "background .12s" }}
            >
              <span
                className="text-[10.5px] font-bold text-navy truncate"
                style={{ minWidth: 92 }}
                title={v.bu_name}
              >
                {v.bu_name}
              </span>
              <div className="flex-1 h-3.5 rounded bg-bg-alt overflow-hidden relative">
                <div
                  className="h-full rounded"
                  style={{ width: `${bar}%`, background: g.c, opacity: 0.9, transition: "width .55s" }}
                />
              </div>
              <span className="font-mono text-[10px] text-ink-subtle hidden sm:inline" style={{ minWidth: 58, textAlign: "right" }}>
                {L(Number(v.actual_revenue))}
              </span>
              <span className="font-mono text-[11px] font-bold" style={{ color: g.c, minWidth: 38, textAlign: "right" }}>
                {rp.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
