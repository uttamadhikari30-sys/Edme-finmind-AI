"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type LeMonth = {
  label: string;
  actualRevenue: number;
  actualExpense: number;
  isFuture: boolean;
};
export type LeEntry = { premium: number; brokerage_pct: number; conversion_pct: number; pipeline: number };

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

function leRevenue(e: LeEntry) {
  return ((e.premium + (e.pipeline * e.conversion_pct) / 100) * e.brokerage_pct) / 100;
}

export default function LeBuilderClient({
  fiscalYear,
  verticalName,
  months,
  avgExpense,
  aopTarget,
  initialLE,
}: {
  fiscalYear: string;
  verticalName: string;
  months: LeMonth[];
  avgExpense: number;
  aopTarget: number;
  initialLE: Record<string, LeEntry>;
}) {
  const [le, setLe] = useState<Record<string, LeEntry>>(() => {
    const m: Record<string, LeEntry> = {};
    months.filter((x) => x.isFuture).forEach((x) => {
      m[x.label] = initialLE[x.label] ?? { premium: 0, brokerage_pct: 11, conversion_pct: 60, pipeline: 0 };
    });
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(label: string, patch: Partial<LeEntry>) {
    setLe((m) => ({ ...m, [label]: { ...m[label], ...patch } }));
    setMsg(null);
  }

  const totals = useMemo(() => {
    let actRev = 0, actExp = 0, leFutureRev = 0, leFutureExp = 0;
    months.forEach((mo) => {
      if (!mo.isFuture) {
        actRev += mo.actualRevenue;
        actExp += mo.actualExpense;
      } else {
        leFutureRev += leRevenue(le[mo.label] ?? { premium: 0, brokerage_pct: 0, conversion_pct: 0, pipeline: 0 });
        leFutureExp += avgExpense;
      }
    });
    const leRev = actRev + leFutureRev;
    const leExp = actExp + leFutureExp;
    const leNet = leRev - leExp;
    const vsAop = aopTarget > 0 ? ((leRev - aopTarget) / aopTarget) * 100 : 0;
    return { actRev, leRev, leExp, leNet, vsAop };
  }, [le, months, avgExpense, aopTarget]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const lines = Object.entries(le).map(([period_label, e]) => ({ period_label, ...e }));
    const res = await fetch("/api/aop/save-le", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, lines }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✓ Saved — future LE revenue ${L(data.le_future_revenue)}` : `⚠ ${data.error}`);
  }

  const numInp = "w-20 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Actual-to-date" value={L(totals.actRev)} tone="navy" />
        <Metric label="Full-Year LE Revenue" value={L(totals.leRev)} tone="green" />
        <Metric label="LE Net Income" value={L(totals.leNet)} tone={totals.leNet >= 0 ? "navy" : "red"} />
        <Metric
          label="LE vs AOP"
          value={aopTarget > 0 ? `${totals.vsAop >= 0 ? "+" : ""}${totals.vsAop.toFixed(1)}%` : "—"}
          tone={totals.vsAop >= 0 ? "green" : "red"}
        />
      </div>

      <Card>
        <CardHeader
          title={`${verticalName} — Latest Estimate (${fiscalYear})`}
          tag={{ label: "Actuals + LE", tone: "navy" }}
          right={
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60">
              {saving ? "Saving…" : "Save LE"}
            </button>
          }
        />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Type</th>
                <th className="r">Premium</th>
                <th className="r">Brok %</th>
                <th className="r">Pipeline</th>
                <th className="r">Conv %</th>
                <th className="r">Revenue</th>
                <th className="r">Expense</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {months.map((mo) => {
                if (!mo.isFuture) {
                  const net = mo.actualRevenue - mo.actualExpense;
                  return (
                    <tr key={mo.label}>
                      <td className="font-semibold">{mo.label}</td>
                      <td><span className="pill pill-navy">Actual</span></td>
                      <td className="r text-ink-subtle">—</td>
                      <td className="r text-ink-subtle">—</td>
                      <td className="r text-ink-subtle">—</td>
                      <td className="r text-ink-subtle">—</td>
                      <td className="r font-semibold">{L(mo.actualRevenue)}</td>
                      <td className="r text-ink-subtle">{L(mo.actualExpense)}</td>
                      <td className={`r font-semibold ${net >= 0 ? "text-navy" : "text-edred"}`}>{L(net)}</td>
                    </tr>
                  );
                }
                const e = le[mo.label];
                const rev = leRevenue(e);
                const net = rev - avgExpense;
                return (
                  <tr key={mo.label} className="bg-gold/[0.04]">
                    <td className="font-semibold">{mo.label}</td>
                    <td><span className="pill pill-gold">LE</span></td>
                    <td className="r"><input type="number" className={numInp} value={e.premium}
                      onChange={(ev) => update(mo.label, { premium: Number(ev.target.value) })} /></td>
                    <td className="r"><input type="number" step="0.5" className="w-14 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none"
                      value={e.brokerage_pct} onChange={(ev) => update(mo.label, { brokerage_pct: Number(ev.target.value) })} /></td>
                    <td className="r"><input type="number" className={numInp} value={e.pipeline}
                      onChange={(ev) => update(mo.label, { pipeline: Number(ev.target.value) })} /></td>
                    <td className="r"><input type="number" className="w-14 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none"
                      value={e.conversion_pct} onChange={(ev) => update(mo.label, { conversion_pct: Number(ev.target.value) })} /></td>
                    <td className="r font-semibold text-edgreen">{L(rev)}</td>
                    <td className="r text-ink-subtle">{L(avgExpense)}</td>
                    <td className={`r font-semibold ${net >= 0 ? "text-navy" : "text-edred"}`}>{L(net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-[var(--border)]">
                <td colSpan={6}>Full-Year LE</td>
                <td className="r text-edgreen">{L(totals.leRev)}</td>
                <td className="r">{L(totals.leExp)}</td>
                <td className={`r ${totals.leNet >= 0 ? "text-navy" : "text-edred"}`}>{L(totals.leNet)}</td>
              </tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      {msg && (
        <div className={`text-[12.5px] font-semibold rounded-lg px-4 py-2.5 ${
          msg.startsWith("✓")
            ? "bg-edgreen-50 text-edgreen border border-edgreen/20"
            : "bg-edred-50 text-edred border border-edred/20"
        }`}>{msg}</div>
      )}
      <p className="text-[11px] text-ink-muted">
        Actual months (Apr–Nov) are booked brokerage. For future months enter expected Premium, Brokerage % and any Pipeline
        with a Conversion %. LE Revenue = (Premium + Pipeline × Conv%) × Brok%. Future-month expense uses your actual monthly run-rate ({L(avgExpense)}).
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
