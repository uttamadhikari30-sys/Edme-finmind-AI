"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Vertical = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manager_user_id: string | null;
  is_active: boolean;
};

type Member = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
};

export default function BusinessUnitsClient({
  orgId,
  isAdmin,
  verticals,
  members,
}: {
  orgId: string;
  isAdmin: boolean;
  verticals: Vertical[];
  members: Member[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vertical | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    manager_user_id: "",
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm({ code: nextCode(), name: "", description: "", manager_user_id: "", is_active: true });
    setShowForm(true);
    setErr(null);
  }

  function startEdit(v: Vertical) {
    setEditing(v);
    setForm({
      code: v.code,
      name: v.name,
      description: v.description ?? "",
      manager_user_id: v.manager_user_id ?? "",
      is_active: v.is_active,
    });
    setShowForm(true);
    setErr(null);
  }

  function nextCode(): string {
    // Generate next EIBLCC code based on the highest existing
    const numbers = verticals
      .map((v) => parseInt(v.code.replace(/[^\d]/g, ""), 10))
      .filter((n) => !isNaN(n));
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    return `EIBLCC${next.toString().padStart(3, "0")}`;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    if (!form.code || !form.name) {
      setBusy(false);
      setErr("Code and Name are required.");
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      manager_user_id: form.manager_user_id || null,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase
        .from("business_units")
        .update(payload)
        .eq("id", editing.id);
      setBusy(false);
      if (error) return setErr(error.message);
    } else {
      const { error } = await supabase
        .from("business_units")
        .insert({ ...payload, org_id: orgId });
      setBusy(false);
      if (error) return setErr(error.message);
    }
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  async function toggleActive(v: Vertical) {
    await supabase
      .from("business_units")
      .update({ is_active: !v.is_active })
      .eq("id", v.id);
    router.refresh();
  }

  async function remove(v: Vertical) {
    if (
      !confirm(
        `Delete vertical "${v.code} · ${v.name}"? Existing journal entries tagged to it will become unallocated.`
      )
    )
      return;
    const { error } = await supabase.from("business_units").delete().eq("id", v.id);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  const active = verticals.filter((v) => v.is_active).length;
  const assigned = verticals.filter((v) => v.manager_user_id).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Tile label="Total Verticals" value={verticals.length} tone="navy" emoji="👥" />
        <Tile label="Active"          value={active}           tone="green" emoji="✅" />
        <Tile label="BH Assigned"     value={`${assigned} / ${verticals.length}`} tone="gold" emoji="🛡" />
      </div>

      <Card>
        <CardHeader
          title="Verticals"
          tag={{ label: `${verticals.length} total`, tone: "navy" }}
          right={
            isAdmin && (
              <button
                onClick={() => (showForm ? setShowForm(false) : startCreate())}
                className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-800"
              >
                {showForm ? "Cancel" : "+ New Vertical"}
              </button>
            )
          }
        />
        {showForm && isAdmin && (
          <CardBody className="border-b border-[var(--border-2)]">
            <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <Field label="Code">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. EIBLCC018"
                  className={inp}
                  required
                />
              </Field>
              <Field label="Name (Business Head)">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Praveen Ladia"
                  className={inp}
                  required
                />
              </Field>
              <Field label="Description">
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional"
                  className={inp}
                />
              </Field>
              <Field label="Manager (assign user)">
                <select
                  value={form.manager_user_id}
                  onChange={(e) => setForm({ ...form, manager_user_id: e.target.value })}
                  className={inp}
                >
                  <option value="">— Unassigned —</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.email} · {m.role}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-edgreen text-white px-4 py-2.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60 shadow-soft"
              >
                {busy ? "Saving…" : editing ? "Update" : "Create"}
              </button>
              {err && (
                <div className="md:col-span-5 text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}
            </form>
          </CardBody>
        )}
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Vertical / BH Name</th>
                  <th>Description</th>
                  <th>Manager</th>
                  <th>Status</th>
                  {isAdmin && <th colSpan={3}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {verticals.map((v) => {
                  const manager = members.find((m) => m.user_id === v.manager_user_id);
                  return (
                    <tr key={v.id}>
                      <td>
                        <span className="font-mono text-[11px] text-navy font-bold">{v.code}</span>
                      </td>
                      <td className="font-semibold">{v.name}</td>
                      <td className="text-ink-muted text-[11.5px]">{v.description ?? "—"}</td>
                      <td className="text-ink-muted">
                        {manager ? (
                          <span>
                            {manager.full_name ?? manager.email}
                            <span className="ml-1 pill pill-navy">{manager.role}</span>
                          </span>
                        ) : (
                          <span className="text-ink-subtle text-[11.5px]">— Unassigned —</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${v.is_active ? "pill-green" : "pill-red"}`}>
                          {v.is_active ? "Active" : "Paused"}
                        </span>
                      </td>
                      {isAdmin && (
                        <>
                          <td>
                            <button
                              onClick={() => startEdit(v)}
                              className="text-[11px] text-navy font-semibold hover:underline"
                            >
                              Edit
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => toggleActive(v)}
                              className={`text-[11px] font-semibold hover:underline ${
                                v.is_active ? "text-gold" : "text-edgreen"
                              }`}
                            >
                              {v.is_active ? "Pause" : "Activate"}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => remove(v)}
                              className="text-[11px] text-edred font-semibold hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        Assigning a user as <b>Manager</b> here, combined with their role being{" "}
        <b>Business Head (BH)</b>, automatically scopes all their dashboard / P&L / vertical views to{" "}
        only their own vertical. CFO / CEO / Finance / Owner roles always see Consolidated.
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  emoji,
}: {
  label: string;
  value: string | number;
  tone: "navy" | "green" | "gold";
  emoji?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${tone}`} />
      {emoji && (
        <div className="absolute right-3 bottom-3 text-[44px] opacity-[0.07] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-subtle mb-2">{label}</div>
      <div
        className={`font-mono text-[24px] font-bold leading-none ${
          tone === "green" ? "text-edgreen" : tone === "gold" ? "text-gold" : "text-navy"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
