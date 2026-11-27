"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type CostLine = {
  category: "hiring" | "direct";
  label: string;
  headcount: number;
  ctc_annual: number;
  amount: number;
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

function blankHiring(): CostLine {
  return { category: "hiring", label: "", headcount: 1, ctc_annual: 0, amount: 0 };
}
function blankDirect(): CostLine {
  return { category: "direct", label: "", headcount: 0, ctc_annual: 0, amount: 0 };
}

export default function CostPlannerClient({
  fiscalYear,
  verticalName,
  committedBrokerage,
  overheadCost,
  overheadFrozen,
  initialLines,
}: {
  fiscalYear: string;
  verticalName: string;
  committedBrokerage: number;
  overheadCost: number;
  overheadFrozen: boolean;
  initialLines: CostLine[];
}) {
  const [lines, setLines] = useState<CostLine[]>(
    initialLines.length ? initialLines : [blankHiring()]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function update(i: number, patch: Partial<CostLine>) {
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        if (next.category === "hiring") next.amount = (next.headcount || 0) * (next.ctc_annual || 0);
        return next;
      })
    );
    setMsg(null);
  }
  function addLine(l: CostLine) { setLines((ls) => [...ls, l]); setMsg(null); }
  function removeLine(i: number) { setLines((ls) => ls.filter((_, idx) => idx !== i)); setMsg(null); }

  const totals = useMemo(() => {
    let hiring = 0, direct = 0, heads = 0;
    lines.forEach((l) => {
      if (l.category === "hiring") { hiring += l.amount; heads += l.headcount || 0; }
      else direct += l.amount;
    });
    return { hiring, direct, heads, myCost: hiring + direct };
  }, [lines]);

  // Full P&L only once Finance has frozen overhead; otherwise provisional (own cost only).
  const fullCost = totals.myCost + (overheadFrozen ? overheadCost : 0);
  const aopProfit = committedBrokerage - fullCost;
  const margin = committedBrokerage > 0 ? (aopProfit / committedBrokerage) * 100 : 0;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/aop/save-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, lines }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✓ Saved — my cost ${L(data.total_cost)}` : `⚠ ${data.error}`);
  }

  const inp = "w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] focus:border-navy outline-none";
  const numInp = "w-20 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none";

  const hiring = lines.map((l, i) => ({ l, i })).filter((x) => x.l.category === "hiring");
  const direct = lines.map((l, i) => ({ l, i })).filter((x) => x.l.category === "direct");

  return (
    <div className="space-y-4">
      {/* Combined AOP P&L */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="Committed Brokerage" value={L(committedBrokerage)} tone="green" />
        <Metric label="My Cost (hiring + direct)" value={L(totals.myCost)} tone="red" />
        <Metric
          label="Allocated Overhead"
          value={overheadFrozen ? L(overheadCost) : "Pending"}
          tone={overheadFrozen ? "gold" : "gold"}
          sub={overheadFrozen ? "frozen by Finance" : "awaiting Finance freeze"}
        />
        <Metric label={overheadFrozen ? "AOP Profit" : "Profit (provisional)"} value={L(aopProfit)} tone={aopProfit >= 0 ? "navy" : "red"} />
        <Metric label="Margin" value={`${margin.toFixed(1)}%`} tone={margin >= 0 ? "navy" : "red"} />
      </div>

      <Card>
        <CardHeader
          title={`${verticalName} — My Cost Plan (${fiscalYear})`}
          tag={{ label: `${totals.heads} new hires`, tone: "navy" }}
          right={
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60">
              {saving ? "Saving…" : "Save cost plan"}
            </button>
          }
        />
        <CardBody className="space-y-5">
          {/* Hiring */}
          <Section title="New Hiring" subtitle="Headcount × annual CTC" total={L(totals.hiring)} onAdd={() => addLine(blankHiring())}>
            <table className="fm-table">
              <thead>
                <tr><th>Role / Label</th><th className="r">Headcount</th><th className="r">Annual CTC</th><th className="r">Cost</th><th></th></tr>
              </thead>
              <tbody>
                {hiring.map(({ l, i }) => (
                  <tr key={i}>
                    <td><input className={inp} placeholder="e.g. Relationship Manager" value={l.label}
                      onChange={(e) => update(i, { label: e.target.value })} /></td>
                    <td className="r"><input type="number" className={numInp} value={l.headcount}
                      onChange={(e) => update(i, { headcount: Number(e.target.value) })} /></td>
                    <td className="r"><input type="number" className={numInp} value={l.ctc_annual}
                      onChange={(e) => update(i, { ctc_annual: Number(e.target.value) })} /></td>
                    <td className="r font-semibold font-mono text-edred">{L(l.amount)}</td>
                    <td className="r"><RemoveBtn onClick={() => removeLine(i)} /></td>
                  </tr>
                ))}
                {hiring.length === 0 && <EmptyRow cols={5} text="No new hires planned." />}
              </tbody>
            </table>
          </Section>

          {/* Direct costs */}
          <Section title="Direct Costs" subtitle="Rent, travel, utilities and other costs for your vertical" total={L(totals.direct)} onAdd={() => addLine(blankDirect())}>
            <table className="fm-table">
              <thead><tr><th>Cost Head</th><th className="r">Annual Amount</th><th></th></tr></thead>
              <tbody>
                {direct.map(({ l, i }) => (
                  <tr key={i}>
                    <td><input className={inp} placeholder="e.g. Branch rent, Travel" value={l.label}
                      onChange={(e) => update(i, { label: e.target.value })} /></td>
                    <td className="r"><input type="number" className={numInp} value={l.amount}
                      onChange={(e) => update(i, { amount: Number(e.target.value) })} /></td>
                    <td className="r"><RemoveBtn onClick={() => removeLine(i)} /></td>
                  </tr>
                ))}
                {direct.length === 0 && <EmptyRow cols={3} text="No direct costs yet." />}
              </tbody>
            </table>
          </Section>
        </CardBody>
      </Card>

      {msg && (
        <div className={`text-[12.5px] font-semibold rounded-lg px-4 py-2.5 ${
          msg.startsWith("✓") ? "bg-edgreen-50 text-edgreen border border-edgreen/20" : "bg-edred-50 text-edred border border-edred/20"
        }`}>{msg}</div>
      )}
      <p className="text-[11px] text-ink-muted">
        You enter your vertical's own costs — new hiring (count × CTC) and direct costs (rent, travel, etc.).
        Mid-office and back-office overhead is set and frozen by Finance; your full AOP Profit appears once Finance freezes it.
      </p>
    </div>
  );
}

function Section({ title, subtitle, total, onAdd, children }: {
  title: string; subtitle: string; total: string; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-[13px] font-bold text-navy">{title}</div>
          <div className="text-[10.5px] text-ink-muted">{subtitle}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[12px] font-mono font-semibold text-ink">{total}</div>
          <button onClick={onAdd} className="px-2.5 py-1 rounded-md border border-navy/30 text-navy text-[11px] font-semibold hover:bg-navy/5">+ Add</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-ink-subtle hover:text-edred text-[14px] leading-none px-1" title="Remove">×</button>;
}
function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="text-center text-ink-subtle py-4 text-[12px]">{text}</td></tr>;
}

function Metric({ label, value, tone, sub }: { label: string; value: string; tone: "navy" | "green" | "gold" | "red"; sub?: string }) {
  const color = { navy: "text-navy", green: "text-edgreen", gold: "text-gold", red: "text-edred" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[18px] font-bold mt-0.5 ${color}`}>{value}</div>
        {sub && <div className="text-[9.5px] text-ink-muted mt-0.5">{sub}</div>}
      </CardBody>
    </Card>
  );
}
