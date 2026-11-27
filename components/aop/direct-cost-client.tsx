"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type OverheadLine = { category: "mid_office" | "back_office"; label: string; amount: number };
export type VerticalCost = {
  id: string;
  code: string;
  name: string;
  committedBrokerage: number;
  bhCost: number; // hiring + direct (entered by the BH)
  lines: OverheadLine[]; // mid + back office (entered by Finance)
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

export default function DirectCostClient({
  fiscalYear,
  verticals,
  frozen,
}: {
  fiscalYear: string;
  verticals: VerticalCost[];
  frozen: boolean;
}) {
  const router = useRouter();
  const [selId, setSelId] = useState(verticals[0]?.id ?? "");
  const [draft, setDraft] = useState<Record<string, OverheadLine[]>>(() => {
    const m: Record<string, OverheadLine[]> = {};
    verticals.forEach((v) => (m[v.id] = v.lines.map((d) => ({ ...d }))));
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = verticals.find((v) => v.id === selId);
  const lines = draft[selId] ?? [];

  function setLines(next: OverheadLine[]) { setDraft((d) => ({ ...d, [selId]: next })); setMsg(null); }
  function update(i: number, patch: Partial<OverheadLine>) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function add(category: "mid_office" | "back_office") { setLines([...lines, { category, label: "", amount: 0 }]); }
  function remove(i: number) { setLines(lines.filter((_, idx) => idx !== i)); }

  const totals = useMemo(() => {
    let mid = 0, back = 0;
    lines.forEach((l) => { if (l.category === "mid_office") mid += Number(l.amount) || 0; else back += Number(l.amount) || 0; });
    return { mid, back, overhead: mid + back };
  }, [lines]);

  if (!sel) return <div className="text-[13px] text-ink-muted">No verticals found.</div>;

  const totalCost = sel.bhCost + totals.overhead;
  const aopProfit = sel.committedBrokerage - totalCost;
  const margin = sel.committedBrokerage > 0 ? (aopProfit / sel.committedBrokerage) * 100 : 0;

  async function save() {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/aop/save-direct-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, business_unit_id: selId, lines }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✓ Saved — overhead ${L(data.total_cost)}` : `⚠ ${data.error}`);
  }

  async function freezeAction(action: "freeze" | "reopen") {
    if (action === "freeze" && !confirm(`Freeze mid-office & back-office overhead for ${fiscalYear}? Each Business Head will then see their full P&L including allocated overhead.`)) return;
    if (action === "reopen" && !confirm(`Reopen overhead for ${fiscalYear} for editing?`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/aop/freeze-overhead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, action }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) router.refresh();
    else setMsg(`⚠ ${data.error}`);
  }

  const inp = "w-full rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] focus:border-navy outline-none disabled:bg-paper disabled:text-ink-subtle";
  const numInp = "w-28 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none disabled:bg-paper disabled:text-ink-subtle";

  const mid = lines.map((l, i) => ({ l, i })).filter((x) => x.l.category === "mid_office");
  const back = lines.map((l, i) => ({ l, i })).filter((x) => x.l.category === "back_office");

  return (
    <div className="space-y-4">
      {/* Freeze control */}
      <Card>
        <CardBody className="py-3 flex items-center gap-3 flex-wrap">
          <span className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border ${
            frozen ? "bg-edgreen/10 text-edgreen border-edgreen/30" : "bg-navy/10 text-navy border-navy/30"
          }`}>{frozen ? "● Overhead frozen" : "● Draft — open for entry"}</span>
          {!frozen ? (
            <button onClick={() => freezeAction("freeze")} disabled={busy}
              className="px-4 py-1.5 rounded-lg bg-edgreen text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-60">
              {busy ? "…" : "Freeze overhead → unlock BH P&L"}
            </button>
          ) : (
            <button onClick={() => freezeAction("reopen")} disabled={busy}
              className="px-4 py-1.5 rounded-lg border border-edred/40 text-edred text-[12px] font-semibold hover:bg-edred-50 disabled:opacity-60">
              {busy ? "…" : "Reopen for editing"}
            </button>
          )}
          <span className="text-[11px] text-ink-muted">Business Heads cannot see these costs until you freeze them.</span>
        </CardBody>
      </Card>

      {/* Vertical selector */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Vertical</label>
        <select value={selId} onChange={(e) => { setSelId(e.target.value); setMsg(null); }}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-navy focus:border-navy outline-none">
          {verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* AOP P&L for the selected vertical */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="Committed Brokerage" value={L(sel.committedBrokerage)} tone="green" />
        <Metric label="BH Cost (hiring+direct)" value={L(sel.bhCost)} tone="gold" />
        <Metric label="Overhead (mid+back)" value={L(totals.overhead)} tone="red" />
        <Metric label="AOP Profit" value={L(aopProfit)} tone={aopProfit >= 0 ? "navy" : "red"} />
        <Metric label="Margin" value={`${margin.toFixed(1)}%`} tone={margin >= 0 ? "navy" : "red"} />
      </div>

      <Card>
        <CardHeader
          title={`${sel.name} — Overhead (${fiscalYear})`}
          tag={{ label: frozen ? "Frozen" : "Finance entry", tone: "navy" }}
          right={
            !frozen && (
              <button onClick={save} disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60">
                {saving ? "Saving…" : "Save overhead"}
              </button>
            )
          }
        />
        <CardBody className="space-y-5">
          <OverheadSection title="Mid-Office" subtitle="Operations / support allocated to this vertical"
            rows={mid} total={L(totals.mid)} frozen={frozen} inp={inp} numInp={numInp}
            onAdd={() => add("mid_office")} update={update} remove={remove} />
          <OverheadSection title="Back-Office" subtitle="Accounts / admin allocated to this vertical"
            rows={back} total={L(totals.back)} frozen={frozen} inp={inp} numInp={numInp}
            onAdd={() => add("back_office")} update={update} remove={remove} />
        </CardBody>
      </Card>

      {msg && (
        <div className={`text-[12.5px] font-semibold rounded-lg px-4 py-2.5 ${
          msg.startsWith("✓") ? "bg-edgreen-50 text-edgreen border border-edgreen/20" : "bg-edred-50 text-edred border border-edred/20"
        }`}>{msg}</div>
      )}
      <p className="text-[11px] text-ink-muted">
        Finance enters mid-office and back-office overhead per vertical. Freeze it to lock the allocation and reveal each vertical's full AOP P&L to its Business Head.
      </p>
    </div>
  );
}

function OverheadSection({ title, subtitle, rows, total, frozen, inp, numInp, onAdd, update, remove }: {
  title: string; subtitle: string; rows: { l: OverheadLine; i: number }[]; total: string; frozen: boolean;
  inp: string; numInp: string; onAdd: () => void; update: (i: number, p: Partial<OverheadLine>) => void; remove: (i: number) => void;
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
          {!frozen && <button onClick={onAdd} className="px-2.5 py-1 rounded-md border border-navy/30 text-navy text-[11px] font-semibold hover:bg-navy/5">+ Add</button>}
        </div>
      </div>
      <table className="fm-table">
        <thead><tr><th>Label</th><th className="r">Annual Cost</th><th></th></tr></thead>
        <tbody>
          {rows.map(({ l, i }) => (
            <tr key={i}>
              <td><input className={inp} disabled={frozen} placeholder="e.g. Shared ops allocation" value={l.label}
                onChange={(e) => update(i, { label: e.target.value })} /></td>
              <td className="r"><input type="number" className={numInp} disabled={frozen} value={l.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) })} /></td>
              <td className="r">{!frozen && <button onClick={() => remove(i)} className="text-ink-subtle hover:text-edred text-[14px] leading-none px-1" title="Remove">×</button>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="text-center text-ink-subtle py-4 text-[12px]">No lines yet.</td></tr>}
        </tbody>
      </table>
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
