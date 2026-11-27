"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type DirectLine = { label: string; amount: number };
export type VerticalCost = {
  id: string;
  code: string;
  name: string;
  committedBrokerage: number;
  peopleCost: number; // BH-entered hiring + mid + back office
  directLines: DirectLine[];
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

export default function DirectCostClient({
  fiscalYear,
  verticals,
}: {
  fiscalYear: string;
  verticals: VerticalCost[];
}) {
  const [selId, setSelId] = useState(verticals[0]?.id ?? "");
  // Editable direct lines per vertical, seeded from the server
  const [draft, setDraft] = useState<Record<string, DirectLine[]>>(() => {
    const m: Record<string, DirectLine[]> = {};
    verticals.forEach((v) => (m[v.id] = v.directLines.length ? v.directLines.map((d) => ({ ...d })) : []));
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = verticals.find((v) => v.id === selId);
  const lines = draft[selId] ?? [];

  function setLines(next: DirectLine[]) {
    setDraft((d) => ({ ...d, [selId]: next }));
    setMsg(null);
  }
  function update(i: number, patch: Partial<DirectLine>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function add() {
    setLines([...lines, { label: "", amount: 0 }]);
  }
  function remove(i: number) {
    setLines(lines.filter((_, idx) => idx !== i));
  }

  const directTotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);

  if (!sel) {
    return <div className="text-[13px] text-ink-muted">No verticals found.</div>;
  }

  const totalCost = sel.peopleCost + directTotal;
  const aopProfit = sel.committedBrokerage - totalCost;
  const margin = sel.committedBrokerage > 0 ? (aopProfit / sel.committedBrokerage) * 100 : 0;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/aop/save-direct-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, business_unit_id: selId, lines }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✓ Saved — direct cost ${L(data.total_cost)}` : `⚠ ${data.error}`);
  }

  const inp = "w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] focus:border-navy outline-none";
  const numInp = "w-28 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none";

  return (
    <div className="space-y-4">
      {/* Vertical selector */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Vertical</label>
        <select
          value={selId}
          onChange={(e) => { setSelId(e.target.value); setMsg(null); }}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-navy focus:border-navy outline-none"
        >
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* AOP P&L for the selected vertical */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="Committed Brokerage" value={L(sel.committedBrokerage)} tone="green" />
        <Metric label="People Cost (BH)" value={L(sel.peopleCost)} tone="gold" />
        <Metric label="Direct Cost" value={L(directTotal)} tone="red" />
        <Metric label="AOP Profit" value={L(aopProfit)} tone={aopProfit >= 0 ? "navy" : "red"} />
        <Metric label="Margin" value={`${margin.toFixed(1)}%`} tone={margin >= 0 ? "navy" : "red"} />
      </div>

      <Card>
        <CardHeader
          title={`${sel.name} — Direct Costs (${fiscalYear})`}
          tag={{ label: "Finance entry", tone: "navy" }}
          right={
            <div className="flex items-center gap-2">
              <button onClick={add}
                className="px-2.5 py-1.5 rounded-md border border-navy/30 text-navy text-[11px] font-semibold hover:bg-navy/5">
                + Add line
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60">
                {saving ? "Saving…" : "Save direct costs"}
              </button>
            </div>
          }
        />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Cost Head</th>
                <th className="r">Annual Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <input className={inp} placeholder="e.g. Office rent, Travel, Utilities" value={l.label}
                      onChange={(e) => update(i, { label: e.target.value })} />
                  </td>
                  <td className="r">
                    <input type="number" className={numInp} value={l.amount}
                      onChange={(e) => update(i, { amount: Number(e.target.value) })} />
                  </td>
                  <td className="r">
                    <button onClick={() => remove(i)} className="text-ink-subtle hover:text-edred text-[14px] leading-none px-1" title="Remove">×</button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={3} className="text-center text-ink-subtle py-5 text-[12px]">No direct costs yet — add rent, travel, utilities…</td></tr>
              )}
            </tbody>
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
        Finance enters direct costs (rent, travel, utilities) per vertical. People costs are entered by the Business Head in AOP Builder.
        AOP Profit = committed brokerage − people cost − direct cost.
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
        <div className={`font-mono text-[18px] font-bold mt-0.5 ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
