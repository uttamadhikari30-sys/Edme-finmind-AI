"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

type Account = { id: string; account_code: string; account_name: string; account_type: string };
type Period = { id: string; period_label: string; status: string };
type BU = { id: string; code: string; name: string };
type Adj = {
  id: string;
  period_id: string;
  account_id: string;
  business_unit_id: string | null;
  adjustment_type: string;
  description: string;
  reason: string | null;
  amount: number;
  is_increase: boolean;
  status: string;
  created_at: string;
  chart_of_accounts: { account_code: string; account_name: string; account_type: string } | null;
  fiscal_periods: { period_label: string } | null;
  business_units: { code: string } | null;
};

const TYPE_TONE: Record<string, "green" | "red" | "navy" | "gold" | "purple"> = {
  revenue: "green",
  cost: "red",
  accrual: "gold",
  prepaid: "navy",
  other: "purple",
};

export default function AdjustmentsClient({
  orgId,
  role,
  accounts,
  periods,
  bus,
  adjustments,
}: {
  orgId: string;
  role: string;
  accounts: Account[];
  periods: Period[];
  bus: BU[];
  adjustments: Adj[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrency();
  const [tab, setTab] = useState<"revenue" | "cost">("revenue");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = periods.find((p) => p.status !== "closed")?.id ?? periods[0]?.id ?? "";

  const [form, setForm] = useState({
    period_id: defaultPeriod,
    account_id: "",
    business_unit_id: "",
    adjustment_type: "revenue" as "revenue" | "cost" | "accrual" | "prepaid" | "other",
    description: "",
    reason: "",
    amount: 0,
    is_increase: true,
  });

  // Sync form type with active tab
  function setActiveTab(t: "revenue" | "cost") {
    setTab(t);
    setForm({ ...form, adjustment_type: t });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    if (!form.account_id || !form.description || form.amount <= 0) {
      setBusy(false);
      setErr("Account, Description, and a positive Amount are required.");
      return;
    }
    const { error } = await supabase.from("adjustment_entries").insert({
      org_id: orgId,
      period_id: form.period_id,
      account_id: form.account_id,
      business_unit_id: form.business_unit_id || null,
      adjustment_type: form.adjustment_type,
      description: form.description,
      reason: form.reason || null,
      amount: form.amount,
      is_increase: form.is_increase,
      status: "posted",
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setShowForm(false);
    setForm({
      period_id: defaultPeriod,
      account_id: "",
      business_unit_id: "",
      adjustment_type: tab,
      description: "",
      reason: "",
      amount: 0,
      is_increase: true,
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this adjustment entry? This affects all downstream reports.")) return;
    await supabase.from("adjustment_entries").delete().eq("id", id);
    router.refresh();
  }

  const filtered = adjustments.filter((a) => a.adjustment_type === tab);

  // KPIs
  const revTotal = adjustments
    .filter((a) => a.adjustment_type === "revenue")
    .reduce((s, a) => s + (a.is_increase ? Number(a.amount) : -Number(a.amount)), 0);
  const costTotal = adjustments
    .filter((a) => a.adjustment_type === "cost")
    .reduce((s, a) => s + (a.is_increase ? Number(a.amount) : -Number(a.amount)), 0);
  const netImpact = revTotal - costTotal;

  // Account list filtered by tab
  const filteredAccounts =
    tab === "revenue"
      ? accounts.filter((a) => a.account_type === "revenue")
      : accounts.filter((a) => a.account_type === "expense");

  return (
    <div className="space-y-4">
      {/* Restricted-access notice */}
      <Card>
        <CardBody className="bg-edpurple-50/40 py-3 px-4 flex items-center gap-3">
          <span className="text-[20px]">🔒</span>
          <div className="text-[12px] text-ink-muted flex-1">
            <span className="font-semibold text-edpurple">Restricted</span> — only Finance, CFO and
            Owner can view and post adjustments. You&apos;re currently logged in as{" "}
            <span className="pill pill-navy">{role}</span>. All adjustments are auto-applied to P&L,
            MIS reports and the dashboard.
          </div>
        </CardBody>
      </Card>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Tile label="Revenue Adjustments" value={formatCurrencyLakhs(revTotal, currency)} tone={revTotal >= 0 ? "green" : "red"} emoji="📈" />
        <Tile label="Cost Adjustments" value={formatCurrencyLakhs(costTotal, currency)} tone="red" emoji="📉" />
        <Tile
          label="Net P&L Impact"
          value={formatCurrencyLakhs(netImpact, currency)}
          tone={netImpact >= 0 ? "green" : "red"}
          emoji="⚖️"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-lg bg-bg-alt border border-[var(--border)]">
        {(["revenue", "cost"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-md text-[12.5px] font-semibold transition ${
              tab === t ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
            }`}
          >
            {t === "revenue" ? "📈 Revenue Adjustments" : "📉 Cost Adjustments"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={`${tab === "revenue" ? "📈 Revenue" : "📉 Cost"} Adjustments`}
          tag={{ label: `${filtered.length} entries`, tone: tab === "revenue" ? "green" : "red" }}
          right={
            <button
              onClick={() => setShowForm((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold ${
                tab === "revenue" ? "bg-edgreen hover:brightness-110" : "bg-edred hover:bg-edred-600"
              }`}
            >
              {showForm ? "Cancel" : "+ New Adjustment"}
            </button>
          }
        />
        {showForm && (
          <CardBody className="border-b border-[var(--border-2)]">
            <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Period">
                <select value={form.period_id} onChange={(e) => setForm({ ...form, period_id: e.target.value })} className={inp} required>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status === "closed"}>
                      {p.period_label} {p.status === "closed" ? "(closed)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Account">
                <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={inp} required>
                  <option value="">— Select account —</option>
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.account_code} · {a.account_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Business Unit (optional)">
                <select value={form.business_unit_id} onChange={(e) => setForm({ ...form, business_unit_id: e.target.value })} className={inp}>
                  <option value="">— Company-level —</option>
                  {bus.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Adjustment Type">
                <select value={form.adjustment_type} onChange={(e) => setForm({ ...form, adjustment_type: e.target.value as any })} className={inp}>
                  <option value="revenue">Revenue</option>
                  <option value="cost">Cost</option>
                  <option value="accrual">Accrual</option>
                  <option value="prepaid">Prepaid</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Direction">
                <select value={form.is_increase ? "inc" : "dec"} onChange={(e) => setForm({ ...form, is_increase: e.target.value === "inc" })} className={inp}>
                  <option value="inc">Increase (+)</option>
                  <option value="dec">Decrease (−)</option>
                </select>
              </Field>
              <Field label="Amount (₹)">
                <input type="number" min="0" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className={inp} required />
              </Field>
              <Field label="Description" wide>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Accrued brokerage for unbilled invoices" className={inp} required />
              </Field>
              <Field label="Reason / Audit Note" wide>
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional — why this adjustment is necessary" className={inp} />
              </Field>
              <div className="md:col-span-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className={`px-4 py-2 rounded-lg text-white font-semibold text-sm shadow-soft ${
                    tab === "revenue" ? "bg-edgreen hover:brightness-110" : "bg-edred hover:bg-edred-600"
                  } disabled:opacity-60`}
                >
                  {busy ? "Posting…" : "Post Adjustment"}
                </button>
                {err && (
                  <span className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
                    {err}
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        )}
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-subtle">
              No {tab} adjustments yet. Click <b>+ New Adjustment</b> to post one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Period</th>
                    <th>Account</th>
                    <th>BU</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="r">Amount</th>
                    <th>Direction</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const amt = a.is_increase ? Number(a.amount) : -Number(a.amount);
                    return (
                      <tr key={a.id}>
                        <td className="text-ink-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                        <td className="text-ink-muted">{a.fiscal_periods?.period_label}</td>
                        <td>
                          <span className="font-mono text-[11px] text-ink-subtle mr-2">
                            {a.chart_of_accounts?.account_code}
                          </span>
                          {a.chart_of_accounts?.account_name}
                        </td>
                        <td>
                          {a.business_units?.code ? (
                            <span className="pill pill-navy">{a.business_units.code}</span>
                          ) : (
                            <span className="text-ink-subtle text-[10.5px]">Co.</span>
                          )}
                        </td>
                        <td>
                          <span className={`pill pill-${TYPE_TONE[a.adjustment_type] ?? "navy"}`}>
                            {a.adjustment_type}
                          </span>
                        </td>
                        <td className="max-w-[280px] truncate" title={a.description}>
                          {a.description}
                        </td>
                        <td className={`r font-mono font-bold ${amt >= 0 ? "text-edgreen" : "text-edred"}`}>
                          {amt >= 0 ? "+" : ""}{formatCurrencyLakhs(amt, currency)}
                        </td>
                        <td>
                          <span className={`pill ${a.is_increase ? "pill-green" : "pill-red"}`}>
                            {a.is_increase ? "▲ Increase" : "▼ Decrease"}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => remove(a.id)}
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
            </div>
          )}
        </CardBody>
      </Card>

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        Adjustments are kept separate from regular journal entries in the audit trail but flow through to
        all P&L / MIS / Dashboard / LE reports via the <code>v_posted_with_adjustments</code> view. Use
        them for accruals, prepayments, write-backs, and year-end corrections that fall outside the
        normal posting flow.
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-3" : ""}>
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
  value: string;
  tone: "navy" | "green" | "red" | "gold" | "purple";
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
        className={`font-mono text-[22px] font-bold leading-none ${
          tone === "green" ? "text-edgreen"
          : tone === "red" ? "text-edred"
          : tone === "gold" ? "text-gold"
          : tone === "purple" ? "text-edpurple"
          : "text-navy"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
