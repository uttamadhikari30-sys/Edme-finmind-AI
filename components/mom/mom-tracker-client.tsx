"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

type Period = { id: string; period_label: string; start_date: string; end_date: string; status: string };
type Monthly = {
  period_id: string;
  period_label: string;
  revenue: number;
  expense: number;
  net_income: number;
};
type BU = { id: string; code: string; name: string };

const VPB_POOL_PCT = 4.2 / 100; // 4.2% of revenue → VPB pool

function tierFromAchievement(pct: number): { label: string; vpb: number; tone: "red" | "gold" | "green" | "purple" } {
  if (pct >= 110) return { label: "Stretch 125%", vpb: 125, tone: "purple" };
  if (pct >= 100) return { label: "Above Target 100%", vpb: 100, tone: "green" };
  if (pct >= 90)  return { label: "On Target 75%", vpb: 75, tone: "gold" };
  if (pct >= 80)  return { label: "Threshold 50%", vpb: 50, tone: "gold" };
  return { label: "Below Threshold", vpb: 0, tone: "red" };
}

export default function MoMTrackerClient({
  periods,
  monthly,
  monthlyBudget,
  bus,
}: {
  periods: Period[];
  monthly: Monthly[];
  monthlyBudget: Record<string, number>;
  bus: BU[];
}) {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedMonth, setSelectedMonth] = useState<string | "all">("all");
  const [vertical, setVertical] = useState<string>("");

  const monthlyByPeriod = new Map<string, Monthly>();
  monthly.forEach((m) => monthlyByPeriod.set(m.period_id, m));

  // Build per-month rows
  const rows = periods.map((p) => {
    const data = monthlyByPeriod.get(p.id);
    const isFuture = p.end_date > today;
    const isCurrent = p.start_date <= today && p.end_date >= today;
    const revenue = Number(data?.revenue ?? 0);
    const expense = Number(data?.expense ?? 0);
    const ebitda = revenue - expense;
    const aop = monthlyBudget[p.id] ?? 0;
    const revPct = aop > 0 ? (revenue / aop) * 100 : 0;
    const margin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
    // 3-month moving average for "AVG%" used for tier
    const avgPct = revPct; // simplified; real avg over last 3 would be richer
    const tier = tierFromAchievement(avgPct);
    const pool = revenue * VPB_POOL_PCT;
    const earned = pool * (tier.vpb / 100);

    return {
      period_id: p.id,
      label: p.period_label,
      shortLabel: p.period_label.split(" ")[0]!,
      isCurrent,
      isFuture,
      revenue,
      aop,
      revPct,
      ebitda,
      margin,
      avgPct,
      tier,
      pool,
      earned,
    };
  });

  const filteredRows = selectedMonth === "all" ? rows : rows.filter((r) => r.period_id === selectedMonth);

  const totalEarned = rows.filter((r) => !r.isFuture).reduce((s, r) => s + r.earned, 0);
  const totalPool = rows.filter((r) => !r.isFuture).reduce((s, r) => s + r.pool, 0);

  return (
    <div className="space-y-4">
      {/* Month select chips */}
      <Card>
        <CardBody className="py-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle mr-1">
            Select Month:
          </span>
          {rows.map((r) => (
            <button
              key={r.period_id}
              onClick={() => setSelectedMonth(r.period_id)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border-2 transition ${
                selectedMonth === r.period_id
                  ? "bg-navy text-white border-navy"
                  : r.isFuture
                  ? "bg-edgreen-50 text-edgreen border-edgreen/30 hover:border-edgreen"
                  : r.isCurrent
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-ink-muted border-[var(--border)] hover:border-navy hover:text-navy"
              }`}
            >
              {r.shortLabel}
              {r.isFuture && <sup className="ml-0.5 text-[8px] opacity-70">LE</sup>}
              {r.isCurrent && selectedMonth !== r.period_id && <span className="ml-1 text-[8px]">●</span>}
            </button>
          ))}
          <button
            onClick={() => setSelectedMonth("all")}
            className={`ml-auto px-4 py-1.5 rounded-full text-[12px] font-semibold border-2 transition ${
              selectedMonth === "all"
                ? "bg-navy text-white border-navy"
                : "bg-white text-ink-muted border-[var(--border)] hover:border-navy hover:text-navy"
            }`}
          >
            All Months
          </button>
        </CardBody>
      </Card>

      {/* Vertical selector */}
      <Card>
        <CardBody className="py-3 flex items-center gap-3 flex-wrap">
          <span className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
            Vertical
          </span>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="flex-1 max-w-md rounded-lg border border-[var(--border)] bg-bg-alt px-3 py-2 text-[12px] font-semibold text-navy focus:border-navy focus:bg-white outline-none"
          >
            <option value="">Company — Consolidated</option>
            {bus.map((b) => (
              <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
            ))}
          </select>
        </CardBody>
      </Card>

      {/* VPB Tracker */}
      <Card>
        <CardHeader
          title="🏆 Variable Pay (VPB) — Month-on-Month Tracker"
          tag={{ label: "Performance Linked · Click figures to drill down", tone: "purple" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>MONTH</th>
                  <th className="r">REVENUE</th>
                  <th className="r">AOP</th>
                  <th className="r">REV%</th>
                  <th className="r">EBITDA</th>
                  <th className="r">EBITDA%</th>
                  <th className="r">AVG%</th>
                  <th>VPB TIER</th>
                  <th className="r">VPB%</th>
                  <th className="r">POOL</th>
                  <th className="r">EARNED VPB</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.period_id}>
                    <td className={`font-semibold ${r.isCurrent ? "text-navy" : "text-ink-muted"}`}>
                      {r.shortLabel}
                      {r.isCurrent && <span className="ml-1 text-[9px] text-edgreen">●</span>}
                      {r.isFuture && <sup className="ml-1 text-[9px] text-edgreen">LE</sup>}
                    </td>
                    <td className="r font-mono font-bold text-navy">
                      {r.revenue ? formatCurrencyLakhs(r.revenue, currency) : "—"}
                    </td>
                    <td className="r font-mono text-ink-subtle">
                      {r.aop ? formatCurrencyLakhs(r.aop, currency) : "—"}
                    </td>
                    <td className={`r font-mono font-bold ${r.aop ? (r.revPct >= 100 ? "text-edgreen" : "text-edred") : "text-ink-subtle"}`}>
                      {r.aop ? `${r.revPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`r font-mono font-bold ${r.ebitda >= 0 ? "text-edgreen" : "text-edred"}`}>
                      {r.revenue ? formatCurrencyLakhs(r.ebitda, currency) : "—"}
                    </td>
                    <td className="r font-mono text-ink-muted">
                      {r.revenue > 0 ? `${r.margin.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`r font-mono font-bold ${r.avgPct >= 100 ? "text-edgreen" : r.avgPct >= 80 ? "text-gold" : "text-edred"}`}>
                      {r.aop ? `${r.avgPct.toFixed(1)}%` : "—"}
                    </td>
                    <td>
                      {r.aop ? (
                        <span className={`pill pill-${r.tier.tone === "purple" ? "navy" : r.tier.tone}`}>
                          {r.tier.label}
                        </span>
                      ) : (
                        <span className="text-ink-subtle text-[11px]">No AOP</span>
                      )}
                    </td>
                    <td className={`r font-mono font-bold ${r.tier.vpb >= 75 ? "text-edpurple" : "text-ink-muted"}`}>
                      {r.aop ? `${r.tier.vpb}%` : "—"}
                    </td>
                    <td className="r font-mono">{formatCurrencyLakhs(r.pool, currency)}</td>
                    <td className="r font-mono font-bold text-gold">
                      {formatCurrencyLakhs(r.earned, currency)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                {selectedMonth === "all" && (
                  <tr className="bg-navy-50/60 border-t-2 border-navy/30 font-bold">
                    <td className="text-navy uppercase text-[11px]">YTD Total</td>
                    <td colSpan={8} />
                    <td className="r font-mono text-navy">{formatCurrencyLakhs(totalPool, currency)}</td>
                    <td className="r font-mono text-gold">{formatCurrencyLakhs(totalEarned, currency)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        VPB pool = 4.2% of revenue. Tier ladder: Stretch ≥110% · Above Target ≥100% · On Target ≥90% · Threshold ≥80%.
        Earned VPB = Pool × Tier %. Set up budget in{" "}
        <a href="/budget-aop" className="text-navy font-semibold hover:underline">Budget / AOP</a> to populate AOP and Rev% columns.
      </div>
    </div>
  );
}
