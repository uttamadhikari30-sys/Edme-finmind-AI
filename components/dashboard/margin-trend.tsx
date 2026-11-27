import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type MonthPoint = { label: string; revenue: number; expense: number };

// EBITDA margin sparkline — ported from the v8 artifact (actual line + AOP target).
export default function MarginTrend({
  months,
  targetPct = 20,
}: {
  months: MonthPoint[];
  targetPct?: number;
}) {
  const pts = months.map((m) => (m.revenue > 0 ? ((m.revenue - m.expense) / m.revenue) * 100 : null));
  const present = pts.filter((v): v is number => v != null);
  if (present.length < 2) return null;

  const W = 560, H = 170, PL = 34, PR = 10, PT = 12, PB = 28;
  const cW = W - PL - PR, cH = H - PT - PB;
  const all = [...present, targetPct];
  const maxM = Math.max(...all) * 1.08;
  const minM = Math.min(...all) * 0.9;
  const xP = (i: number) => PL + i * (cW / (months.length - 1));
  const yP = (v: number) => PT + cH - ((v - minM) / (maxM - minM)) * cH;

  const gridVals = [Math.round(minM), Math.round((minM + maxM) / 2), Math.round(maxM)];
  const linePts = pts
    .map((v, i) => (v != null ? `${xP(i).toFixed(1)},${yP(v).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ");
  const lastActualIx = pts.reduce((acc, v, i) => (v != null ? i : acc), 0);

  return (
    <Card>
      <CardHeader title="📈 EBITDA Margin Trend" tag={{ label: `target ${targetPct}%`, tone: "navy" }} />
      <CardBody className="px-2 py-2">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
          {gridVals.map((g, i) => {
            const gy = yP(g);
            return (
              <g key={i}>
                <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="rgba(28,54,135,.06)" strokeDasharray="3,4" />
                <text x={PL - 5} y={gy + 3} fill="#a0aacc" fontSize="8.5" textAnchor="end" fontFamily="monospace">{g}%</text>
              </g>
            );
          })}
          {/* AOP target line */}
          <line x1={PL} y1={yP(targetPct)} x2={W - PR} y2={yP(targetPct)} stroke="#ED1B2F" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.5" />
          {/* actual margin line */}
          <polyline points={linePts} fill="none" stroke="#00875a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((v, i) =>
            v != null ? (
              <circle key={i} cx={xP(i)} cy={yP(v)} r={i === lastActualIx ? 4.5 : 2.5}
                fill={i === lastActualIx ? "#00875a" : "#fff"} stroke="#00875a" strokeWidth={i === lastActualIx ? 0 : 2} />
            ) : null
          )}
          {months.map((m, i) =>
            i % 2 === 0 ? (
              <text key={i} x={xP(i)} y={H - 6} fill="#a0aacc" fontSize="8.5" textAnchor="middle" fontFamily="sans-serif">
                {String(m.label ?? "").split(" ")[0]}
              </text>
            ) : null
          )}
        </svg>
      </CardBody>
    </Card>
  );
}
