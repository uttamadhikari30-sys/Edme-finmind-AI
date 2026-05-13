"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export type Tier = {
  id: string;
  label: string;
  min_pct: number;
  max_pct: number;
  vpb_pct: number;
  tone: string;
  priority: number;
  is_active: boolean;
};

const TONES = ["navy", "green", "gold", "red", "purple"] as const;

export default function TierRulesEditor({
  orgId,
  tiers,
  canEdit,
}: {
  orgId: string;
  tiers: Tier[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState<Tier | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    label: "",
    min_pct: 0,
    max_pct: 100,
    vpb_pct: 0,
    tone: "navy",
    priority: tiers.length + 1,
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(t: Tier) {
    setEditing(t);
    setShowNew(false);
    setForm({
      label: t.label, min_pct: t.min_pct, max_pct: t.max_pct, vpb_pct: t.vpb_pct,
      tone: t.tone, priority: t.priority, is_active: t.is_active,
    });
  }

  function startNew() {
    setEditing(null);
    setShowNew(true);
    setForm({ label: "", min_pct: 0, max_pct: 100, vpb_pct: 0, tone: "navy", priority: tiers.length + 1, is_active: true });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = {
      label: form.label,
      min_pct: Number(form.min_pct),
      max_pct: Number(form.max_pct),
      vpb_pct: Number(form.vpb_pct),
      tone: form.tone,
      priority: Number(form.priority),
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("vpb_tiers").update(payload).eq("id", editing.id);
      if (error) { setErr(error.message); setBusy(false); return; }
    } else {
      const { error } = await supabase.from("vpb_tiers").insert({ ...payload, org_id: orgId });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    setBusy(false);
    setEditing(null);
    setShowNew(false);
    router.refresh();
  }

  async function remove(t: Tier) {
    if (!confirm(`Delete tier "${t.label}"?`)) return;
    await supabase.from("vpb_tiers").delete().eq("id", t.id);
    router.refresh();
  }

  async function toggle(t: Tier) {
    await supabase.from("vpb_tiers").update({ is_active: !t.is_active }).eq("id", t.id);
    router.refresh();
  }

  const sorted = [...tiers].sort((a, b) => a.priority - b.priority);

  return (
    <Card>
      <CardHeader
        title="🏆 Tier Rules"
        tag={{ label: `${tiers.length} tiers`, tone: "purple" }}
        right={
          canEdit && (
            <button
              onClick={() => (showNew ? setShowNew(false) : startNew())}
              className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-800"
            >
              {showNew ? "Cancel" : "+ New Tier"}
            </button>
          )
        }
      />
      {(showNew || editing) && canEdit && (
        <CardBody className="border-b border-[var(--border-2)]">
          <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <Field label="Label" wide>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required placeholder="e.g. Above Target 100%" className={inp} />
            </Field>
            <Field label="Min %">
              <input type="number" step="0.1" value={form.min_pct} onChange={(e) => setForm({ ...form, min_pct: parseFloat(e.target.value) })} required className={inp} />
            </Field>
            <Field label="Max %">
              <input type="number" step="0.1" value={form.max_pct} onChange={(e) => setForm({ ...form, max_pct: parseFloat(e.target.value) })} required className={inp} />
            </Field>
            <Field label="VPB %">
              <input type="number" step="0.1" value={form.vpb_pct} onChange={(e) => setForm({ ...form, vpb_pct: parseFloat(e.target.value) })} required className={inp} />
            </Field>
            <Field label="Tone">
              <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className={inp}>
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) })} required className={inp} />
            </Field>
            <button type="submit" disabled={busy} className="md:col-span-6 rounded-lg bg-edgreen text-white py-2.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60">
              {busy ? "Saving…" : editing ? "Update tier" : "Create tier"}
            </button>
            {err && <div className="md:col-span-6 text-[11.5px] text-edred">{err}</div>}
          </form>
        </CardBody>
      )}
      <CardBody className="p-0">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Tier</th>
              <th className="r">Achievement</th>
              <th className="r">VPB %</th>
              <th>Status</th>
              {canEdit && <th colSpan={3}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td><span className="pill pill-navy">#{t.priority}</span></td>
                <td className="font-semibold">{t.label}</td>
                <td className="r font-mono text-ink-muted">
                  {t.min_pct === 0 ? `< ${t.max_pct}%` : t.max_pct >= 9999 ? `≥ ${t.min_pct}%` : `${t.min_pct}% – ${t.max_pct}%`}
                </td>
                <td className="r font-mono font-bold text-edpurple">{t.vpb_pct}%</td>
                <td>
                  <span className={`pill ${t.is_active ? "pill-green" : "pill-red"}`}>
                    {t.is_active ? "Active" : "Paused"}
                  </span>
                </td>
                {canEdit && (
                  <>
                    <td><button onClick={() => startEdit(t)} className="text-[11px] text-navy font-semibold hover:underline">Edit</button></td>
                    <td><button onClick={() => toggle(t)} className={`text-[11px] font-semibold hover:underline ${t.is_active ? "text-gold" : "text-edgreen"}`}>{t.is_active ? "Pause" : "Activate"}</button></td>
                    <td><button onClick={() => remove(t)} className="text-[11px] text-edred font-semibold hover:underline">Delete</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 text-[11.5px] text-ink-muted border-t border-[var(--border-2)]">
          <b>How it works:</b> Each Business Head&apos;s achievement % places them in a tier; the tier determines what % of their VPB pool they earn. Pool = 4.2% of revenue achieved. {canEdit ? "Edit any tier to change the ladder for FY 2025-26 onward." : "Only CFO / Owner can edit the tier ladder."}
        </div>
      </CardBody>
    </Card>
  );
}

const inp = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
