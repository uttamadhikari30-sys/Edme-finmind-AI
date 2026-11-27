"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type PlanLine = {
  client_id: string;
  product_line_id: string;
  client: string;
  product: string;
  basis: "renewal" | "new";
  last_year_premium: number;
  planned_premium: number;
  brokerage_pct: number;
  conversion_pct: number;
  included: boolean;
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;
const CONV_THRESHOLD = 60; // 60% fixed, per your AOP rule

export default function AopBuilderClient({
  fiscalYear,
  basisYear,
  verticalName,
  initialLines,
}: {
  fiscalYear: string;
  basisYear: string;
  verticalName: string;
  initialLines: PlanLine[];
}) {
  const [lines, setLines] = useState<PlanLine[]>(initialLines);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(i: number, patch: Partial<PlanLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setMsg(null);
  }

  const totals = useMemo(() => {
    let lyBrok = 0, plPrem = 0, committedBrok = 0, pipelineBrok = 0;
    lines.forEach((l) => {
      lyBrok += (l.last_year_premium * l.brokerage_pct) / 100;
      if (!l.included) return;
      plPrem += l.planned_premium;
      const brok = (l.planned_premium * l.brokerage_pct) / 100;
      const counts = l.basis === "renewal" || l.conversion_pct >= CONV_THRESHOLD;
      if (counts) committedBrok += brok;
      else pipelineBrok += brok;
    });
    const growth = lyBrok > 0 ? ((committedBrok - lyBrok) / lyBrok) * 100 : 0;
    return { lyBrok, plPrem, committedBrok, pipelineBrok, growth };
  }, [lines]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/aop/save-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, lines }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✓ Saved ${data.lines} lines — committed brokerage ${L(data.planned_brokerage)}` : `⚠ ${data.error}`);
  }

  const inp = "w-24 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Planned Premium" value={L(totals.plPrem)} tone="navy" />
        <Metric label={`Committed Brokerage (${fiscalYear})`} value={L(totals.committedBrok)} tone="green" />
        <Metric label="Pipeline (< 60%, excluded)" value={L(totals.pipelineBrok)} tone="gold" />
        <Metric
          label={`Growth vs ${basisYear}`}
          value={`${totals.growth >= 0 ? "+" : ""}${totals.growth.toFixed(1)}%`}
          tone={totals.growth >= 0 ? "green" : "red"}
        />
      </div>

      <Card>
        <CardHeader
          title={`${verticalName} — Client Plan`}
          tag={{ label: `${lines.length} lines`, tone: "navy" }}
          right={
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save AOP plan"}
            </button>
          }
        />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Product</th>
                <th>Basis</th>
                <th className="r">LY Premium</th>
                <th className="r">Planned Premium</th>
                <th className="r">Brok %</th>
                <th className="r">Conv %</th>
                <th className="r">Brokerage</th>
                <th>Incl.</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const brok = (l.planned_premium * l.brokerage_pct) / 100;
                const counts = l.basis === "renewal" || l.conversion_pct >= CONV_THRESHOLD;
                return (
                  <tr key={`${l.client_id}|${l.product_line_id}`} className={l.included ? "" : "opacity-40"}>
                    <td className="font-semibold">{l.client}</td>
                    <td className="text-[11.5px] text-ink-muted">{l.product}</td>
                    <td>
                      <span className={`pill ${l.basis === "new" ? "pill-gold" : "pill-navy"}`}>
                        {l.basis === "new" ? "New" : "Renewal"}
                      </span>
                    </td>
                    <td className="r text-ink-subtle">{L(l.last_year_premium)}</td>
                    <td className="r">
                      <input
                        type="number"
                        className={inp}
                        value={l.planned_premium}
                        onChange={(e) => update(i, { planned_premium: Number(e.target.value) })}
                      />
                    </td>
                    <td className="r">
                      <input
                        type="number"
                        step="0.5"
                        className="w-16 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none"
                        value={l.brokerage_pct}
                        onChange={(e) => update(i, { brokerage_pct: Number(e.target.value) })}
                      />
                    </td>
                    <td className="r">
                      <input
                        type="number"
                        className={`w-16 rounded-md border px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none ${
                          l.basis === "new" && !counts ? "border-edred bg-edred-50" : "border-[var(--border)] bg-white"
                        }`}
                        value={l.conversion_pct}
                        onChange={(e) => update(i, { conversion_pct: Number(e.target.value) })}
                        disabled={l.basis === "renewal"}
                      />
                    </td>
                    <td className={`r font-semibold ${counts ? "text-edgreen" : "text-ink-subtle line-through"}`}>
                      {L(brok)}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={l.included}
                        onChange={(e) => update(i, { included: e.target.checked })}
                        className="w-4 h-4 accent-navy"
                      />
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-ink-subtle py-6">
                    No {basisYear} client policies to carry forward yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {msg && (
        <div
          className={`text-[12.5px] font-semibold rounded-lg px-4 py-2.5 ${
            msg.startsWith("✓")
              ? "bg-edgreen-50 text-edgreen border border-edgreen/20"
              : "bg-edred-50 text-edred border border-edred/20"
          }`}
        >
          {msg}
        </div>
      )}
      <p className="text-[11px] text-ink-muted">
        Renewal brokerage always counts. New business counts only when conversion ≥ {CONV_THRESHOLD}% (your fixed rule);
        below that it stays in pipeline and is excluded from the committed AOP.
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "gold" | "red" }) {
  const color = { navy: "text-navy", green: "text-edgreen", gold: "text-gold", red: "text-edred" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[19px] font-bold mt-0.5 ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
