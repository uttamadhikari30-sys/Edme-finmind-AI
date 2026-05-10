"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

type Vertical = {
  id: string;
  code: string;
  name: string;
  headName: string;
  hc: number;
  revenue: number;
  expense: number;
  revAOP: number;
};

function tierFromPct(pct: number) {
  if (pct >= 110) return { label: "Stretch 125%", tone: "purple" as const };
  if (pct >= 100) return { label: "Above Target", tone: "green" as const };
  if (pct >= 90)  return { label: "On Target 75%", tone: "gold" as const };
  if (pct >= 80)  return { label: "Threshold", tone: "gold" as const };
  return { label: "Below Threshold", tone: "red" as const };
}

function statusFromPct(pct: number) {
  if (pct >= 100) return { label: "On Track", dot: "bg-edgreen", color: "text-edgreen" };
  if (pct >= 90) return { label: "At Risk", dot: "bg-gold", color: "text-gold" };
  return { label: "At Risk", dot: "bg-edred", color: "text-edred" };
}

export default function VerticalMatrixClient({
  verticals,
  currentPeriodLabel,
}: {
  verticals: Vertical[];
  currentPeriodLabel: string;
}) {
  const currency = useCurrency();

  const totalRev = verticals.reduce((s, v) => s + v.revenue, 0);
  const totalRevAOP = verticals.reduce((s, v) => s + v.revAOP, 0);
  const totalExpense = verticals.reduce((s, v) => s + v.expense, 0);
  const totalEbitda = totalRev - totalExpense;
  const aboveAOP = verticals.filter((v) => v.revAOP > 0 && v.revenue >= v.revAOP).length;
  const overallVarPct = totalRevAOP > 0 ? ((totalRev - totalRevAOP) / totalRevAOP) * 100 : 0;
  const ebitdaMargin = totalRev > 0 ? (totalEbitda / totalRev) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiTile
          label="Total Verticals"
          value={`${verticals.length}`}
          sub="Active Business Heads"
          tone="navy"
          emoji="👥"
        />
        <KpiTile
          label="Above AOP"
          value={`${aboveAOP}`}
          sub={`of ${verticals.length} verticals`}
          tone="green"
          emoji="✅"
        />
        <KpiTile
          label="Total Revenue"
          value={formatCurrencyLakhs(totalRev, currency)}
          sub={totalRevAOP > 0 ? `${overallVarPct >= 0 ? "+" : ""}${overallVarPct.toFixed(1)}% vs AOP` : "No AOP yet"}
          tone="gold"
          emoji="💰"
        />
        <KpiTile
          label="Total EBITDA"
          value={formatCurrencyLakhs(totalEbitda, currency)}
          sub={totalRev > 0 ? `${ebitdaMargin.toFixed(1)}% margin` : "—"}
          tone={totalEbitda >= 0 ? "green" : "red"}
          emoji="📊"
        />
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader
          title={`All Verticals · ${currentPeriodLabel}`}
          tag={{ label: "incl. VPB Tier", tone: "purple" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Business Head</th>
                  <th className="r">Rev Actual</th>
                  <th className="r">Rev AOP</th>
                  <th className="r">Rev%</th>
                  <th className="r">EBITDA</th>
                  <th className="r">EBITDA AOP</th>
                  <th className="r">EBITDA%</th>
                  <th className="r">Margin</th>
                  <th>VPB Tier</th>
                  <th className="r">YoY</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {verticals
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((v) => {
                    const initials = v.headName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const ebitda = v.revenue - v.expense;
                    const ebitdaAOP = v.revAOP * 0.28; // estimate 28% margin on AOP
                    const margin = v.revenue > 0 ? (ebitda / v.revenue) * 100 : 0;
                    const revPct = v.revAOP > 0 ? ((v.revenue - v.revAOP) / v.revAOP) * 100 : 0;
                    const ebitdaPct = ebitdaAOP > 0 ? ((ebitda - ebitdaAOP) / ebitdaAOP) * 100 : 0;
                    const tier = tierFromPct(v.revAOP > 0 ? (v.revenue / v.revAOP) * 100 : 0);
                    const status = statusFromPct(v.revAOP > 0 ? (v.revenue / v.revAOP) * 100 : 100);

                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-navy">{v.headName}</div>
                              <div className="text-[10px] text-ink-subtle">
                                {v.name} · {v.hc} HC
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="r font-mono font-bold text-navy">{formatCurrencyLakhs(v.revenue, currency)}</td>
                        <td className="r font-mono text-ink-subtle">
                          {v.revAOP > 0 ? formatCurrencyLakhs(v.revAOP, currency) : "—"}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1 bg-bg-alt rounded relative overflow-hidden flex-shrink-0">
                              <div
                                className={`absolute inset-y-0 left-0 rounded ${
                                  revPct >= 0 ? "bg-edgreen" : "bg-edred"
                                }`}
                                style={{ width: `${Math.min(Math.abs(revPct), 100)}%` }}
                              />
                            </div>
                            <span className={`font-mono font-bold text-[12px] ${revPct >= 0 ? "text-edgreen" : "text-edred"}`}>
                              {v.revAOP > 0 ? `${revPct >= 0 ? "+" : ""}${revPct.toFixed(1)}%` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className={`r font-mono font-bold ${ebitda >= 0 ? "text-edgreen" : "text-edred"}`}>
                          {formatCurrencyLakhs(ebitda, currency)}
                        </td>
                        <td className="r font-mono text-ink-subtle">
                          {ebitdaAOP > 0 ? formatCurrencyLakhs(ebitdaAOP, currency) : "—"}
                        </td>
                        <td className={`r font-mono font-bold ${ebitdaPct >= 0 ? "text-edgreen" : "text-edred"}`}>
                          {ebitdaAOP > 0 ? `${ebitdaPct >= 0 ? "+" : ""}${ebitdaPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="r font-mono">{v.revenue > 0 ? `${margin.toFixed(1)}%` : "—"}</td>
                        <td>
                          <span className={`pill ${tier.tone === "purple" ? "pill-navy" : `pill-${tier.tone}`}`}>
                            {tier.label}
                          </span>
                        </td>
                        <td className="r font-mono text-ink-subtle">—</td>
                        <td>
                          <span className={`flex items-center gap-1.5 ${status.color} font-semibold text-[11px]`}>
                            <span className={`w-2 h-2 rounded-full ${status.dot}`} /> {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
  emoji,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "navy" | "green" | "red" | "gold" | "purple";
  emoji?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-6 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={`kpi-accent ${tone}`} />
      {emoji && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[60px] opacity-[0.06] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-ink-subtle mb-3">{label}</div>
      <div
        className={`font-mono text-[32px] font-semibold leading-none ${
          tone === "green"
            ? "text-edgreen"
            : tone === "red"
            ? "text-edred"
            : tone === "gold"
            ? "text-gold"
            : tone === "purple"
            ? "text-edpurple"
            : "text-navy"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2.5 inline-block text-[11px] font-semibold px-2 py-1 rounded bg-edgreen-50 text-edgreen">
          {sub}
        </div>
      )}
    </div>
  );
}
