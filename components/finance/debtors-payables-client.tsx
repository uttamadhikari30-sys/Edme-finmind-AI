"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { parseCSV, pick, downloadText } from "@/lib/csv";

export type DP = {
  id: string;
  kind: "debtor" | "payable";
  party: string;
  team: "corporate" | "ri" | "other";
  invoice_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  collected: number;
  status: string;
  notes: string | null;
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;
const BUCKETS = ["Not due", "0–30", "31–60", "61–90", "90+"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketOf(due: string | null): Bucket {
  if (!due) return "Not due";
  const days = Math.floor((Date.now() - new Date(due + "T00:00:00").getTime()) / 86400000);
  if (days < 0) return "Not due";
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

const TEAM_LABEL: Record<string, string> = { corporate: "Corporate", ri: "RI (Reinsurance)", other: "Other" };

function blank(): DP {
  return { id: "", kind: "debtor", party: "", team: "corporate", invoice_no: "", invoice_date: "", due_date: "", amount: 0, collected: 0, status: "open", notes: "" };
}

export default function DebtorsPayablesClient({ initial }: { initial: DP[] }) {
  const router = useRouter();
  const [items, setItems] = useState<DP[]>(initial);
  const [form, setForm] = useState<DP | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const debtors = items.filter((i) => i.kind === "debtor");
  const payables = items.filter((i) => i.kind === "payable");
  const out = (i: DP) => Math.max(i.amount - i.collected, 0);

  const totals = useMemo(() => {
    const recv = debtors.reduce((s, i) => s + out(i), 0);
    const overdue = debtors.filter((i) => bucketOf(i.due_date) !== "Not due").reduce((s, i) => s + out(i), 0);
    const pay = payables.reduce((s, i) => s + out(i), 0);
    return { recv, overdue, pay, net: recv - pay };
  }, [items]);

  // Collection report: outstanding by team × ageing bucket (debtors only)
  const report = useMemo(() => {
    const teams = ["corporate", "ri", "other"] as const;
    const grid: Record<string, Record<Bucket, number>> = {};
    teams.forEach((t) => (grid[t] = { "Not due": 0, "0–30": 0, "31–60": 0, "61–90": 0, "90+": 0 }));
    debtors.forEach((i) => {
      const o = out(i);
      if (o <= 0) return;
      grid[i.team][bucketOf(i.due_date)] += o;
    });
    return grid;
  }, [items]);

  async function save(row: DP) {
    if (!row.party.trim()) { setMsg("⚠ Party name required"); return; }
    setBusy(true); setMsg(null);
    const res = await fetch("/api/finance/save-dp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save", item: row }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(`⚠ ${data.error}`); return; }
    setForm(null);
    setMsg("✓ Saved");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    setBusy(true);
    await fetch("/api/finance/save-dp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete", item: { id } }) });
    setBusy(false);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  function exportReport() {
    const open = debtors.filter((i) => out(i) > 0).sort((a, b) => out(b) - out(a));
    const header = "Team,Party,Invoice,Due Date,Outstanding,Ageing,Notes";
    const lines = open.map((i) =>
      [TEAM_LABEL[i.team], i.party, i.invoice_no ?? "", i.due_date ?? "", (out(i)).toFixed(0), bucketOf(i.due_date), (i.notes ?? "").replace(/,/g, ";")]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    );
    downloadText(`collection-report-${new Date().toISOString().slice(0, 10)}.csv`, `${header}\n${lines.join("\n")}`);
  }

  function downloadTemplate() {
    downloadText("debtors-payables-template.csv",
      "Kind,Party,Team,Invoice,Invoice Date,Due Date,Amount,Collected,Notes\n" +
      "debtor,Reliance Industries,corporate,INV-1001,2026-10-15,2026-11-14,2500000,0,GMC renewal\n" +
      "debtor,GIC Re,ri,RI-2001,2026-10-01,2026-10-31,1800000,0,RI commission\n" +
      "payable,Office rent,other,BILL-01,2026-11-01,2026-11-30,900000,0,Q3 rent\n" +
      "# Kind: debtor | payable   Team: corporate | ri | other");
  }

  async function handleUpload(file: File) {
    setBusy(true); setMsg(null);
    try {
      const rows = parseCSV(await file.text()).filter((r) => pick(r, "party"));
      let saved = 0;
      for (const r of rows) {
        const item: Partial<DP> = {
          kind: pick(r, "kind").toLowerCase() === "payable" ? "payable" : "debtor",
          party: pick(r, "party"),
          team: (["corporate", "ri", "other"].includes(pick(r, "team").toLowerCase()) ? pick(r, "team").toLowerCase() : "corporate") as any,
          invoice_no: pick(r, "invoice", "invoice no", "invoice_no"),
          invoice_date: pick(r, "invoice date", "invoice_date"),
          due_date: pick(r, "due date", "due_date"),
          amount: Number(pick(r, "amount")) || 0,
          collected: Number(pick(r, "collected")) || 0,
          notes: pick(r, "notes"),
        };
        const res = await fetch("/api/finance/save-dp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "save", item }) });
        if (res.ok) saved++;
      }
      setMsg(`✓ Imported ${saved} entr${saved === 1 ? "y" : "ies"}`);
      router.refresh();
    } catch (e: any) {
      setMsg(`⚠ ${e?.message ?? "Could not read file"}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Receivables (Outstanding)" value={L(totals.recv)} tone="green" />
        <Tile label="Overdue Receivables" value={L(totals.overdue)} tone="red" />
        <Tile label="Payables (Outstanding)" value={L(totals.pay)} tone="gold" />
        <Tile label="Net Position" value={L(totals.net)} tone={totals.net >= 0 ? "navy" : "red"} />
      </div>

      {/* Collection report */}
      <Card>
        <CardHeader
          title="Collection Report — Ageing by Team"
          tag={{ label: "for Corporate & RI", tone: "navy" }}
          right={
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              <button onClick={downloadTemplate} className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-ink-muted text-[12px] font-semibold hover:bg-bg-alt">⬇ Template</button>
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 py-1.5 rounded-lg border border-navy/30 text-navy text-[12px] font-semibold hover:bg-navy/5 disabled:opacity-60">⬆ Upload</button>
              <button onClick={exportReport} className="px-4 py-1.5 rounded-lg bg-edgreen text-white text-[12px] font-semibold hover:opacity-90">⬇ Export Report (CSV)</button>
            </div>
          }
        />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr><th>Team</th>{BUCKETS.map((b) => <th key={b} className="r">{b}</th>)}<th className="r">Total</th></tr>
            </thead>
            <tbody>
              {(["corporate", "ri", "other"] as const).map((t) => {
                const row = report[t];
                const tot = BUCKETS.reduce((s, b) => s + row[b], 0);
                if (tot <= 0) return null;
                return (
                  <tr key={t}>
                    <td className="font-semibold">{TEAM_LABEL[t]}</td>
                    {BUCKETS.map((b) => <td key={b} className={`r ${b === "90+" && row[b] > 0 ? "text-edred font-semibold" : "text-ink-subtle"}`}>{row[b] > 0 ? L(row[b]) : "—"}</td>)}
                    <td className="r font-bold">{L(tot)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-[var(--border)]">
                <td>All</td>
                {BUCKETS.map((b) => {
                  const col = (["corporate", "ri", "other"] as const).reduce((s, t) => s + report[t][b], 0);
                  return <td key={b} className="r">{col > 0 ? L(col) : "—"}</td>;
                })}
                <td className="r text-edgreen">{L(totals.recv)}</td>
              </tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      {/* Receivables */}
      <DPTable title="Receivables (Debtors)" rows={debtors} out={out} onEdit={(r) => setForm({ ...r })} onDelete={remove} onAdd={() => setForm({ ...blank(), kind: "debtor" })} tone="green" />
      {/* Payables */}
      <DPTable title="Payables (Creditors)" rows={payables} out={out} onEdit={(r) => setForm({ ...r })} onDelete={remove} onAdd={() => setForm({ ...blank(), kind: "payable" })} tone="gold" />

      {msg && <div className={`text-[12.5px] font-semibold rounded-lg px-4 py-2.5 ${msg.startsWith("✓") ? "bg-edgreen-50 text-edgreen border border-edgreen/20" : "bg-edred-50 text-edred border border-edred/20"}`}>{msg}</div>}

      {/* Edit / Add modal */}
      {form && <EntryModal form={form} setForm={setForm} save={save} busy={busy} />}
    </div>
  );
}

function DPTable({ title, rows, out, onEdit, onDelete, onAdd, tone }: {
  title: string; rows: DP[]; out: (i: DP) => number; onEdit: (r: DP) => void; onDelete: (id: string) => void; onAdd: () => void; tone: "green" | "gold";
}) {
  return (
    <Card>
      <CardHeader title={title} tag={{ label: `${rows.length} open`, tone: tone === "green" ? "green" : "gold" }}
        right={<button onClick={onAdd} className="px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-semibold hover:opacity-90">+ Add</button>} />
      <CardBody className="p-0">
        <table className="fm-table">
          <thead>
            <tr><th>Party</th><th>Team</th><th>Invoice</th><th>Due</th><th className="r">Amount</th><th className="r">Outstanding</th><th>Ageing</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const o = out(i);
              const b = bucketOf(i.due_date);
              return (
                <tr key={i.id} className={o <= 0 ? "opacity-50" : ""}>
                  <td className="font-semibold">{i.party}</td>
                  <td className="text-[11.5px] text-ink-muted">{TEAM_LABEL[i.team]}</td>
                  <td className="text-[11.5px] text-ink-subtle">{i.invoice_no ?? "—"}</td>
                  <td className="text-[11.5px] text-ink-subtle">{i.due_date ?? "—"}</td>
                  <td className="r">{L(i.amount)}</td>
                  <td className={`r font-semibold ${o > 0 ? "" : "text-ink-subtle"}`}>{o > 0 ? L(o) : "Settled"}</td>
                  <td><span className={`pill ${b === "90+" ? "pill-red" : b === "Not due" ? "pill-navy" : "pill-gold"}`}>{b}</span></td>
                  <td className="r whitespace-nowrap">
                    <button onClick={() => onEdit(i)} className="text-navy text-[11px] font-semibold px-1.5 hover:underline">Edit</button>
                    <button onClick={() => onDelete(i.id)} className="text-ink-subtle hover:text-edred text-[14px] px-1">×</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-ink-subtle py-5">None yet.</td></tr>}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function EntryModal({ form, setForm, save, busy }: { form: DP; setForm: (f: DP | null) => void; save: (r: DP) => void; busy: boolean }) {
  const f = form;
  const set = (p: Partial<DP>) => setForm({ ...f, ...p });
  const inp = "w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12.5px] focus:border-navy outline-none";
  const lbl = "text-[10px] uppercase tracking-wider font-bold text-ink-subtle mb-1";
  return (
    <div className="fixed inset-0 z-[9000] bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="text-[15px] font-bold text-navy mb-4">{f.id ? "Edit" : "Add"} {f.kind === "payable" ? "Payable" : "Receivable"}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><div className={lbl}>Party</div><input className={inp} value={f.party} onChange={(e) => set({ party: e.target.value })} placeholder="Client / insurer / vendor" /></div>
          <div><div className={lbl}>Type</div>
            <select className={inp} value={f.kind} onChange={(e) => set({ kind: e.target.value as any })}><option value="debtor">Receivable</option><option value="payable">Payable</option></select>
          </div>
          <div><div className={lbl}>Team</div>
            <select className={inp} value={f.team} onChange={(e) => set({ team: e.target.value as any })}><option value="corporate">Corporate</option><option value="ri">RI (Reinsurance)</option><option value="other">Other</option></select>
          </div>
          <div><div className={lbl}>Invoice No.</div><input className={inp} value={f.invoice_no ?? ""} onChange={(e) => set({ invoice_no: e.target.value })} /></div>
          <div><div className={lbl}>Amount (₹)</div><input type="number" className={inp} value={f.amount} onChange={(e) => set({ amount: Number(e.target.value) })} /></div>
          <div><div className={lbl}>Invoice Date</div><input type="date" className={inp} value={f.invoice_date ?? ""} onChange={(e) => set({ invoice_date: e.target.value })} /></div>
          <div><div className={lbl}>Due Date</div><input type="date" className={inp} value={f.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value })} /></div>
          <div><div className={lbl}>Collected (₹)</div><input type="number" className={inp} value={f.collected} onChange={(e) => set({ collected: Number(e.target.value) })} /></div>
          <div><div className={lbl}>Notes</div><input className={inp} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={() => setForm(null)} className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-[12.5px] font-semibold">Cancel</button>
          <button onClick={() => save(f)} disabled={busy} className="px-5 py-1.5 rounded-lg bg-edred text-white text-[12.5px] font-semibold hover:bg-edred-600 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "red" | "gold" }) {
  const color = { navy: "text-navy", green: "text-edgreen", red: "text-edred", gold: "text-gold" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[20px] font-bold mt-0.5 ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
