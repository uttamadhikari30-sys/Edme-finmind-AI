"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";

type Purpose = "mis" | "aop";

type Rule = {
  id: string;
  org_id: string;
  name: string;
  source_account: string | null;
  source_type: "expense" | "revenue";
  method: "direct" | "percent" | "headcount" | "revenue";
  is_active: boolean;
  priority: number;
  notes: string | null;
  purpose: Purpose;
};
type Target = { id: string; rule_id: string; business_unit_id: string; weight: number };
type Account = { id: string; account_code: string; account_name: string; account_type: string };
type BU = { id: string; code: string; name: string };

const METHODS = [
  { id: "direct",    label: "Direct (single BU)",   desc: "All to one vertical" },
  { id: "percent",   label: "Percentage split",     desc: "Custom % per vertical (must total 100%)" },
  { id: "headcount", label: "By headcount",         desc: "Auto-split by people count per vertical" },
  { id: "revenue",   label: "By revenue share",     desc: "Auto-split by revenue contribution" },
];

const PURPOSE_INFO: Record<Purpose, { label: string; desc: string; tone: "navy" | "gold" }> = {
  mis: {
    label: "MIS (Actuals)",
    desc: "Applied to posted journal entries when generating live P&L, vertical performance, and live KPIs.",
    tone: "navy",
  },
  aop: {
    label: "Budget / AOP (Planning)",
    desc: "Applied during AOP build-out — distributes Finance Layer costs across verticals before approval.",
    tone: "gold",
  },
};

export default function AllocationRulesClient({
  orgId,
  rules,
  targets,
  accounts,
  bus,
}: {
  orgId: string;
  rules: Rule[];
  targets: Target[];
  accounts: Account[];
  bus: BU[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [purpose, setPurpose] = useState<Purpose>("mis");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    source_account: "",
    source_type: "expense" as "expense" | "revenue",
    method: "percent" as Rule["method"],
    notes: "",
  });
  const [weights, setWeights] = useState<Record<string, number>>({});

  function setWeight(buId: string, val: number) {
    setWeights({ ...weights, [buId]: val });
  }

  const totalWeight = Object.values(weights).reduce((s, v) => s + (v || 0), 0);
  const filteredRules = rules.filter((r) => r.purpose === purpose);
  const misCount = rules.filter((r) => r.purpose === "mis").length;
  const aopCount = rules.filter((r) => r.purpose === "aop").length;

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    if (!form.name) {
      setErr("Name is required");
      setBusy(false);
      return;
    }
    if (form.method === "percent" && Math.abs(totalWeight - 100) > 0.01) {
      setErr(`Percentages must total 100%. Currently ${totalWeight.toFixed(1)}%`);
      setBusy(false);
      return;
    }

    const { data: rule, error: ruleErr } = await supabase
      .from("allocation_rules")
      .insert({
        org_id: orgId,
        name: form.name,
        source_account: form.source_account || null,
        source_type: form.source_type,
        method: form.method,
        notes: form.notes || null,
        is_active: true,
        priority: filteredRules.length + 1,
        purpose,
      })
      .select()
      .single();

    if (ruleErr || !rule) {
      setErr(ruleErr?.message ?? "Could not create rule");
      setBusy(false);
      return;
    }

    const targetRows = Object.entries(weights)
      .filter(([_, w]) => w && w > 0)
      .map(([buId, w]) => ({
        rule_id: rule.id,
        business_unit_id: buId,
        weight: w,
      }));
    if (targetRows.length > 0) {
      await supabase.from("allocation_rule_targets").insert(targetRows);
    }

    setForm({ name: "", source_account: "", source_type: "expense", method: "percent", notes: "" });
    setWeights({});
    setShowForm(false);
    setBusy(false);
    router.refresh();
  }

  async function toggleRule(rule: Rule) {
    await supabase
      .from("allocation_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    router.refresh();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    await supabase.from("allocation_rules").delete().eq("id", rule.id);
    router.refresh();
  }

  async function copyToOtherPurpose(rule: Rule) {
    const otherPurpose: Purpose = rule.purpose === "mis" ? "aop" : "mis";
    const { data: copy } = await supabase
      .from("allocation_rules")
      .insert({
        org_id: orgId,
        name: `${rule.name} (copied to ${otherPurpose.toUpperCase()})`,
        source_account: rule.source_account,
        source_type: rule.source_type,
        method: rule.method,
        notes: rule.notes,
        is_active: true,
        priority: 100,
        purpose: otherPurpose,
      })
      .select()
      .single();
    if (copy) {
      const ruleTargets = targets.filter((t) => t.rule_id === rule.id);
      if (ruleTargets.length) {
        await supabase.from("allocation_rule_targets").insert(
          ruleTargets.map((t) => ({
            rule_id: copy.id,
            business_unit_id: t.business_unit_id,
            weight: t.weight,
          }))
        );
      }
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Purpose tab toggle */}
      <Card>
        <CardBody className="py-4 flex items-center gap-3 flex-wrap">
          <span className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
            Rule Book
          </span>
          {(["mis", "aop"] as Purpose[]).map((p) => {
            const info = PURPOSE_INFO[p];
            const count = p === "mis" ? misCount : aopCount;
            return (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition ${
                  purpose === p
                    ? `border-${info.tone === "gold" ? "gold" : "navy"} bg-white shadow-soft`
                    : "border-[var(--border)] bg-bg-alt hover:border-navy/40"
                }`}
              >
                <span className="text-[14px] font-bold text-navy">{info.label}</span>
                <span className={`pill ${info.tone === "gold" ? "pill-gold" : "pill-navy"}`}>
                  {count} rules
                </span>
              </button>
            );
          })}
          <div className="flex-1" />
          <p className="text-[11.5px] text-ink-muted max-w-md">{PURPOSE_INFO[purpose].desc}</p>
        </CardBody>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader title="How allocation works" tag={{ label: "Logic", tone: "purple" }} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {METHODS.map((m) => (
              <div key={m.id} className="rounded-lg border border-[var(--border)] p-3 bg-bg-alt">
                <div className="text-[11px] font-bold uppercase tracking-wider text-navy">{m.label}</div>
                <div className="text-[11.5px] text-ink-muted mt-1.5 leading-relaxed">{m.desc}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ink-muted leading-relaxed">
            <b>MIS rules</b> apply to posted journal entries when computing live P&amp;L, KPIs, and vertical performance.{" "}
            <b>AOP rules</b> apply during the budgeting cycle to distribute Finance Layer costs across verticals before
            CFO/CEO approval. The two rule books can differ — for example, you might split costs equally across all
            verticals in AOP planning but apply revenue-weighted distribution for MIS actuals.
          </p>
        </CardBody>
      </Card>

      {/* Add rule */}
      <Card>
        <CardHeader
          title={`${PURPOSE_INFO[purpose].label} Rules`}
          tag={{ label: `${filteredRules.length} rules`, tone: PURPOSE_INFO[purpose].tone === "gold" ? "gold" : "navy" }}
          right={
            <button
              onClick={() => setShowForm((v) => !v)}
              className={`px-3 py-1.5 rounded-lg ${
                purpose === "mis" ? "bg-navy hover:bg-navy-800" : "bg-gold hover:brightness-110"
              } text-white text-xs font-semibold`}
            >
              {showForm ? "Cancel" : `+ New ${purpose.toUpperCase()} rule`}
            </button>
          }
        />
        {showForm && (
          <CardBody className="border-b border-[var(--border-2)]">
            <form onSubmit={createRule} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Rule Name">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Allocate office rent across verticals"
                    className={inpCls}
                    required
                  />
                </Field>
                <Field label="Source Account">
                  <select
                    value={form.source_account}
                    onChange={(e) => setForm({ ...form, source_account: e.target.value })}
                    className={inpCls}
                  >
                    <option value="">— Any account of this type —</option>
                    {accounts
                      .filter((a) => a.account_type === form.source_type)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} · {a.account_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Source Type">
                  <select
                    value={form.source_type}
                    onChange={(e) =>
                      setForm({ ...form, source_type: e.target.value as "expense" | "revenue" })
                    }
                    className={inpCls}
                  >
                    <option value="expense">Expense</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </Field>
                <Field label="Method">
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value as Rule["method"] })}
                    className={inpCls}
                  >
                    {METHODS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {(form.method === "percent" || form.method === "direct") && (
                <div>
                  <div className="flex items-center mb-1.5">
                    <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
                      Weights per Vertical {form.method === "percent" ? "(must total 100%)" : "(pick exactly one)"}
                    </label>
                    {form.method === "percent" && (
                      <span
                        className={`ml-auto text-[11px] font-bold ${
                          Math.abs(totalWeight - 100) < 0.01 ? "text-edgreen" : "text-edred"
                        }`}
                      >
                        Total: {totalWeight.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {bus.map((b) => (
                      <div key={b.id} className="rounded-lg border border-[var(--border)] p-2 bg-bg-alt">
                        <div className="text-[10px] font-bold text-navy">{b.code}</div>
                        <div className="text-[10.5px] text-ink-subtle truncate" title={b.name}>{b.name}</div>
                        <input
                          type="number"
                          min={0}
                          max={form.method === "percent" ? 100 : undefined}
                          step="0.1"
                          value={weights[b.id] ?? ""}
                          onChange={(e) => setWeight(b.id, parseFloat(e.target.value))}
                          placeholder={form.method === "percent" ? "%" : "value"}
                          className="mt-1 w-full rounded border border-[var(--border)] bg-white px-2 py-1 text-[12px] focus:border-navy outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(form.method === "headcount" || form.method === "revenue") && (
                <div className="rounded-lg bg-navy-50/40 border border-navy/15 p-3 text-[11.5px] text-ink-muted">
                  ℹ {form.method === "headcount"
                    ? "Weights auto-computed from members assigned to each vertical."
                    : "Weights auto-computed from each vertical's revenue share in the period."}
                </div>
              )}

              <Field label="Notes">
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional explanation for this rule"
                  className={inpCls}
                />
              </Field>

              {err && (
                <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-60 ${
                  purpose === "mis" ? "bg-navy hover:bg-navy-800" : "bg-gold hover:brightness-110"
                }`}
              >
                {busy ? "Saving…" : `Save ${purpose.toUpperCase()} rule`}
              </button>
            </form>
          </CardBody>
        )}
        <CardBody className="p-0">
          {filteredRules.length === 0 ? (
            <EmptyState
              icon="⚙️"
              title={`No ${purpose.toUpperCase()} allocation rules yet`}
              body={
                purpose === "mis"
                  ? "Create rules to distribute mid/back-office costs and shared revenue across verticals when computing live MIS."
                  : "Create rules for the AOP planning cycle. These don't affect actuals — they only apply when consolidating Budget/AOP."
              }
            />
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Rule</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Targets</th>
                  <th>Status</th>
                  <th colSpan={2}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((r) => {
                  const t = targets.filter((tr) => tr.rule_id === r.id);
                  const sourceAcc = accounts.find((a) => a.id === r.source_account);
                  return (
                    <tr key={r.id}>
                      <td><span className="pill pill-navy">#{r.priority}</span></td>
                      <td className="font-semibold">{r.name}</td>
                      <td className="text-ink-muted">
                        {sourceAcc ? `${sourceAcc.account_code} · ${sourceAcc.account_name}` : `Any ${r.source_type}`}
                      </td>
                      <td><span className="pill pill-gold">{r.method}</span></td>
                      <td className="text-[11px] text-ink-muted">
                        {t.length > 0
                          ? t
                              .map((tt) => {
                                const bu = bus.find((b) => b.id === tt.business_unit_id);
                                return `${bu?.code ?? "?"} ${tt.weight}${r.method === "percent" ? "%" : ""}`;
                              })
                              .join(" · ")
                          : "—"}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleRule(r)}
                          className={`pill ${r.is_active ? "pill-green" : "pill-red"} cursor-pointer`}
                        >
                          {r.is_active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => copyToOtherPurpose(r)}
                          className="text-[11px] text-navy font-semibold hover:underline"
                          title={`Duplicate to ${r.purpose === "mis" ? "AOP" : "MIS"} rule book`}
                        >
                          → {r.purpose === "mis" ? "AOP" : "MIS"}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => deleteRule(r)}
                          className="text-[11px] text-edred font-semibold hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

const inpCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
