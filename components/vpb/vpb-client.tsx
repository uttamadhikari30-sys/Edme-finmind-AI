"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

type Vertical = {
  id: string;
  code: string;
  name: string;
  headName: string;
  revenue: number;
  expense: number;
  revAOP: number;
};

type Tab = "calculator" | "mom" | "tier-rules" | "fy-projection";

const VPB_POOL_PCT = 4.2 / 100;

const TIERS = [
  { id: "stretch", label: "Stretch 125%", min: 110, max: Infinity, vpb: 125, tone: "purple" },
  { id: "above",   label: "Above Target 100%", min: 100, max: 110, vpb: 100, tone: "green" },
  { id: "ontarget",label: "On Target 75%", min: 90, max: 100, vpb: 75, tone: "gold" },
  { id: "thresh",  label: "Threshold 50%", min: 80, max: 90, vpb: 50, tone: "gold" },
  { id: "below",   label: "Below Threshold", min: 0, max: 80, vpb: 0, tone: "red" },
] as const;

function tierFor(pct: number) {
  return TIERS.find((t) => pct >= t.min && pct < t.max) ?? TIERS[4];
}

export default function VPBClient({ verticals }: { verticals: Vertical[] }) {
  const currency = useCurrency();
  const [tab, setTab] = useState<Tab>("calculator");

  const calc = verticals.map((v) => {
    const ebitda = v.revenue - v.expense;
    const ebitdaAOP = v.revAOP * 0.28;
    const revPct = v.revAOP > 0 ? (v.revenue / v.revAOP) * 100 : 0;
    const ebitdaPct = ebitdaAOP > 0 ? (ebitda / ebitdaAOP) * 100 : 0;
    const avgPct = (revPct + ebitdaPct) / 2;
    const tier = tierFor(avgPct);
    const pool = v.revenue * VPB_POOL_PCT;
    const earned = pool * (tier!.vpb / 100);
    const remaining = pool - earned;

    // Compute next tier gap
    const nextTier = TIERS.find((t) => t.min > avgPct);
    const gap = nextTier ? nextTier.min - avgPct : 0;

    return {
      ...v,
      ebitda,
      ebitdaAOP,
      revPct,
      ebitdaPct,
      avgPct,
      tier,
      pool,
      earned,
      remaining,
      nextTier,
      gap,
    };
  });

  const totalEarned = calc.reduce((s, c) => s + c.earned, 0);
  const totalPool = calc.reduce((s, c) => s + c.pool, 0);
  const aboveAOP = calc.filter((c) => c.revPct >= 100).length;
  const needsAttention = calc.filter((c) => c.tier!.vpb < 50).length;

  return (
    <div className="space-y-4">
      {/* 3 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile
          label={`Earned (current period)`}
          value={formatCurrencyLakhs(totalEarned, currency)}
          sub={totalPool > 0 ? `${((totalEarned / totalPool) * 100).toFixed(0)}% of pool` : "—"}
          tone="green"
        />
        <KpiTile
          label="Above AOP"
          value={`${aboveAOP}/${verticals.length}`}
          sub="Verticals qualifying"
          tone="purple"
        />
        <KpiTile
          label="Needs Attention"
          value={`${needsAttention} BHs`}
          sub={`${needsAttention === 0 ? "All above threshold" : "0% VPB — below threshold"}`}
          tone="red"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-bg-alt border border-[var(--border)] overflow-x-auto">
        {([
          { id: "calculator", label: "📊 Calculator" },
          { id: "mom", label: "📅 Month-on-Month" },
          { id: "tier-rules", label: "🏆 Tier Rules" },
          { id: "fy-projection", label: "📈 FY Projection" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit py-2.5 px-4 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition ${
              tab === t.id ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "calculator" && (
        <Card>
          <CardHeader
            title="🏆 Business Heads · Current Period"
            tag={{ label: `Pool = ${(VPB_POOL_PCT * 100).toFixed(1)}% of Revenue`, tone: "purple" }}
            right={
              <button className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-white text-[11.5px] font-semibold text-ink-muted hover:border-edgreen hover:text-edgreen flex items-center gap-1">
                ⬇ Export
              </button>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Business Head</th>
                    <th className="r">Rev Actual</th>
                    <th className="r">Rev AOP</th>
                    <th className="r">Rev %</th>
                    <th className="r">EBITDA</th>
                    <th className="r">EBITDA AOP</th>
                    <th className="r">EBITDA %</th>
                    <th className="r">Avg %</th>
                    <th>Tier</th>
                    <th className="r">VPB %</th>
                    <th className="r">Pool</th>
                    <th className="r">Earned</th>
                    <th className="r">Remaining</th>
                    <th>Next Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.map((c) => {
                    const initials = c.headName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-navy text-[12px]">{c.headName}</div>
                              <div className="text-[9.5px] text-ink-subtle">{c.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="r font-mono font-bold text-navy">{formatCurrencyLakhs(c.revenue, currency)}</td>
                        <td className="r font-mono text-ink-subtle">
                          {c.revAOP > 0 ? formatCurrencyLakhs(c.revAOP, currency) : "—"}
                        </td>
                        <td className={`r font-mono font-bold ${c.revPct >= 100 ? "text-edgreen" : "text-edred"}`}>
                          {c.revAOP > 0 ? `${c.revPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className={`r font-mono ${c.ebitda >= 0 ? "text-edgreen" : "text-edred"}`}>
                          {formatCurrencyLakhs(c.ebitda, currency)}
                        </td>
                        <td className="r font-mono text-ink-subtle">
                          {c.ebitdaAOP > 0 ? formatCurrencyLakhs(c.ebitdaAOP, currency) : "—"}
                        </td>
                        <td className={`r font-mono font-bold ${c.ebitdaPct >= 100 ? "text-edgreen" : "text-edred"}`}>
                          {c.ebitdaAOP > 0 ? `${c.ebitdaPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="r font-mono font-bold text-navy">
                          {c.revAOP > 0 ? `${c.avgPct.toFixed(1)}%` : "—"}
                        </td>
                        <td>
                          <span className={`pill ${c.tier!.tone === "purple" ? "pill-navy" : `pill-${c.tier!.tone}`}`}>
                            {c.tier!.label}
                          </span>
                        </td>
                        <td className={`r font-mono font-bold ${c.tier!.vpb >= 75 ? "text-edpurple" : "text-ink-muted"}`}>
                          {c.revAOP > 0 ? `${c.tier!.vpb}%` : "—"}
                        </td>
                        <td className="r font-mono">{formatCurrencyLakhs(c.pool, currency)}</td>
                        <td className="r font-mono font-bold text-gold">{formatCurrencyLakhs(c.earned, currency)}</td>
                        <td className="r font-mono text-ink-muted">{formatCurrencyLakhs(c.remaining, currency)}</td>
                        <td className="text-[10.5px] text-ink-muted">
                          {c.nextTier && c.revAOP > 0
                            ? `Need avg ≥${c.nextTier.min}% for ${c.nextTier.label} — gap: ${c.gap.toFixed(1)}pp`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-navy-50/60 border-t-2 border-navy/30 font-bold">
                    <td colSpan={10} className="text-right uppercase text-[11px] text-navy">YTD Total</td>
                    <td className="r font-mono text-navy">{formatCurrencyLakhs(totalPool, currency)}</td>
                    <td className="r font-mono text-gold">{formatCurrencyLakhs(totalEarned, currency)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "mom" && (
        <Card>
          <CardHeader title="Month-on-Month VPB Tracker" />
          <CardBody>
            <p className="text-[13px] text-ink-muted">
              See <a href="/mom" className="text-navy font-semibold hover:underline">Month-on-Month P&L</a>{" "}
              for the full monthly VPB tracker by company. This tab will show per-Business-Head monthly VPB once
              monthly business-unit data is decomposed.
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "tier-rules" && (
        <Card>
          <CardHeader
            title="🏆 Tier Rules"
            tag={{ label: "Edme VPB Policy", tone: "purple" }}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {TIERS.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border-2 p-4 bg-white"
                  style={{
                    borderColor:
                      t.tone === "green" ? "rgba(0,168,120,0.3)"
                      : t.tone === "purple" ? "rgba(124,58,237,0.3)"
                      : t.tone === "gold" ? "rgba(200,149,42,0.3)"
                      : "rgba(237,27,47,0.3)",
                  }}
                >
                  <div
                    className={`text-[14px] font-bold ${
                      t.tone === "green" ? "text-edgreen"
                      : t.tone === "purple" ? "text-edpurple"
                      : t.tone === "gold" ? "text-gold"
                      : "text-edred"
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="mt-2 text-[11.5px] text-ink-muted">
                    Achievement: {t.min === 0 ? "<" + t.max + "%" : `≥${t.min}% ${t.max === Infinity ? "" : `< ${t.max}%`}`}
                  </div>
                  <div className="mt-3 font-mono text-[24px] font-bold text-navy">{t.vpb}%</div>
                  <div className="text-[10.5px] text-ink-subtle">of pool earned</div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-[12px] text-ink-muted leading-relaxed bg-bg-alt p-4 rounded-lg">
              <b>How it works:</b> Each Business Head&apos;s achievement % = average of (Rev Actual ÷ Rev AOP) and
              (EBITDA Actual ÷ EBITDA AOP). The achievement % places them in a tier; the tier determines what % of
              their VPB pool they earn. Pool = {(VPB_POOL_PCT * 100).toFixed(1)}% of revenue achieved.
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "fy-projection" && (
        <Card>
          <CardHeader title="📈 FY Projection" tag={{ label: "Year-end estimate", tone: "navy" }} />
          <CardBody>
            <p className="text-[13px] text-ink-muted">
              Year-end VPB earnings projection per Business Head, using their current run-rate. Wires to{" "}
              <a href="/le-forecast" className="text-navy font-semibold hover:underline">LE & Forecast</a>{" "}
              data once the BH-level forecast is broken out.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "navy" | "green" | "red" | "gold" | "purple";
}) {
  return (
    <div className="bg-white rounded-[14px] p-6 border border-[var(--border)] shadow-soft relative overflow-hidden text-center">
      <div className={`kpi-accent ${tone}`} />
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-ink-subtle mb-3">{label}</div>
      <div
        className={`font-mono text-[36px] font-bold leading-none ${
          tone === "green"
            ? "text-edgreen"
            : tone === "red"
            ? "text-edred"
            : tone === "purple"
            ? "text-edpurple"
            : tone === "gold"
            ? "text-gold"
            : "text-navy"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-3 text-[11.5px] text-ink-subtle">{sub}</div>}
    </div>
  );
}
