"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatINRUnit } from "@/lib/utils";

type Budget = { id: string; name: string; fiscal_year: string; status: string; created_at: string };
type BU = { id: string; code: string; name: string };
type Account = { id: string; account_code: string; account_name: string; account_type: string };
type Member = { user_id: string; email: string; full_name: string | null; role: string };

type Tab = "submissions" | "finance" | "allocation" | "consolidated" | "review";

export default function BudgetAopClient({
  orgId,
  budgets,
  bus,
  accounts,
  members,
}: {
  orgId: string;
  budgets: Budget[];
  bus: BU[];
  accounts: Account[];
  members: Member[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("submissions");
  const [busy, setBusy] = useState(false);

  const activeBudget = budgets[0];
  const businessHeads = members.filter((m) => m.role === "bh");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "submissions", label: "BH Submissions", icon: "👥" },
    { id: "finance",     label: "Finance Layer",  icon: "🏛" },
    { id: "allocation",  label: "Cost Allocation",icon: "⚙️" },
    { id: "consolidated",label: "Consolidated P&L", icon: "📊" },
    { id: "review",      label: "CFO/CEO Review", icon: "🔒" },
  ];

  async function createBudget() {
    setBusy(true);
    const fy = `FY ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`;
    const { error } = await supabase
      .from("budgets")
      .insert({ org_id: orgId, name: `AOP ${fy}`, fiscal_year: fy, status: "draft" });
    setBusy(false);
    if (!error) router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiTile
          label="AOP Revenue (Total)"
          value={activeBudget ? formatINRUnit(0) : "Not set up"}
          sub={activeBudget?.fiscal_year ?? "Create AOP first"}
          tone="navy"
          emoji="🎯"
        />
        <KpiTile
          label="BH Submissions"
          value={`0 / ${bus.length}`}
          sub="Bottom-up budget"
          tone="green"
          emoji="✅"
        />
        <KpiTile
          label="CFO Approved"
          value="0"
          sub="Pending review"
          tone="gold"
          emoji="🛡"
        />
        <KpiTile
          label="Total Headcount (AOP)"
          value="0"
          sub={`${bus.length} verticals`}
          tone="purple"
          emoji="👥"
        />
      </div>

      {!activeBudget && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[13px] text-ink-muted">
                No active budget yet. Create one to start the AOP process.
              </div>
              <button
                onClick={createBudget}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-edred text-white font-semibold text-sm hover:bg-edred-600 disabled:opacity-60 shadow-soft"
              >
                + Create Budget {`FY ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tab strip */}
      <div className="flex gap-2 p-1 rounded-lg bg-bg-alt border border-[var(--border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-[12px] font-semibold whitespace-nowrap transition ${
              tab === t.id ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "submissions" && (
        <Card>
          <CardHeader title="Business Head Submissions" tag={{ label: `${bus.length} verticals`, tone: "navy" }} />
          <CardBody className="p-0">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Vertical</th>
                  <th>Business Head</th>
                  <th>Status</th>
                  <th className="r">Revenue (AOP)</th>
                  <th className="r">EBITDA (AOP)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bus.map((b) => {
                  const head = businessHeads.find((m) => m.full_name?.toLowerCase().includes(b.code.toLowerCase()));
                  return (
                    <tr key={b.id}>
                      <td className="font-semibold">
                        <span className="pill pill-navy">{b.code}</span> {b.name}
                      </td>
                      <td className="text-ink-muted">{head?.full_name ?? head?.email ?? "— Unassigned —"}</td>
                      <td>
                        <span className="pill pill-gold">Pending</span>
                      </td>
                      <td className="r font-mono text-ink-subtle">—</td>
                      <td className="r font-mono text-ink-subtle">—</td>
                      <td>
                        <button className="text-[11px] text-navy font-semibold hover:underline">
                          Send reminder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {tab === "finance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="🏢 Mid & Back Office Costs" tag={{ label: "Finance Input", tone: "navy" }} />
            <CardBody className="p-0">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Cost Head</th>
                    <th className="r">FY26 Act</th>
                    <th className="r">FY27 AOP</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts
                    .filter((a) => a.account_type === "expense")
                    .slice(0, 8)
                    .map((a) => (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.account_name}</td>
                        <td className="r font-mono text-ink-subtle">—</td>
                        <td className="r">
                          <input
                            type="number"
                            placeholder="0"
                            className="w-28 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right focus:border-navy outline-none"
                          />
                        </td>
                        <td>
                          <span className="pill pill-navy">Overhead</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-[var(--border-2)]">
                <button className="text-[11.5px] font-semibold text-navy hover:underline">+ Add Cost Line</button>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="📉 Depreciation & Capex" tag={{ label: "Finance Input", tone: "gold" }} />
            <CardBody>
              <div className="space-y-3">
                <Field label="Capex Plan (FY27)">
                  <input type="number" placeholder="0" className={inpCls} />
                </Field>
                <Field label="Depreciation (annual)">
                  <input type="number" placeholder="0" className={inpCls} />
                </Field>
                <Field label="Useful life (years)">
                  <input type="number" placeholder="5" className={inpCls} />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "allocation" && (
        <Card>
          <CardHeader title="Cost Allocation Preview" tag={{ label: "From rules", tone: "purple" }} />
          <CardBody>
            <div className="text-[13px] text-ink-muted mb-3">
              This view shows how Finance Layer costs (mid/back office) get distributed to verticals via your{" "}
              <a href="/allocation-rules" className="text-navy font-semibold hover:underline">
                Allocation Rules
              </a>
              . Set up rules first to populate this preview.
            </div>
            <a
              href="/allocation-rules"
              className="inline-block px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-800"
            >
              ⚙️ Open Allocation Rules →
            </a>
          </CardBody>
        </Card>
      )}

      {tab === "consolidated" && (
        <Card>
          <CardHeader title="Consolidated P&L (AOP)" tag={{ label: "Auto-built", tone: "green" }} />
          <CardBody>
            <button className="px-4 py-2 rounded-lg bg-edred text-white font-semibold text-sm hover:bg-edred-600 shadow-soft">
              ⚡ Build Consolidated AOP
            </button>
            <p className="text-[12px] text-ink-muted mt-3">
              Once BH submissions are received and Finance Layer is filled, click to merge into a single board-ready P&L.
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "review" && (
        <Card>
          <CardHeader title="🔒 CFO / CEO Review" tag={{ label: "Approval Gate", tone: "red" }} />
          <CardBody>
            <div className="space-y-3 text-[13px] text-ink-muted">
              <div className="flex items-center gap-2">
                <span className="pill pill-gold">PENDING</span>
                <span>BH Submissions: 0/{bus.length} received</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill pill-gold">PENDING</span>
                <span>Finance Layer: not entered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pill pill-gold">PENDING</span>
                <span>Consolidated P&L: not built</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button className="px-4 py-2 rounded-lg bg-edgreen text-white font-semibold text-sm hover:brightness-110 shadow-soft">
                  ✅ Approve AOP
                </button>
                <button className="px-4 py-2 rounded-lg border border-[var(--border)] bg-white text-ink-muted font-semibold text-sm hover:border-edred hover:text-edred">
                  Request Changes
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
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

function KpiTile({
  label,
  value,
  sub,
  tone,
  emoji,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "navy" | "green" | "gold" | "purple" | "red";
  emoji?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${tone}`} />
      {emoji && (
        <div className="absolute right-3 bottom-3 text-[40px] opacity-[0.07] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle mb-2">{label}</div>
      <div
        className={`font-mono text-[22px] font-semibold leading-none ${
          tone === "green"
            ? "text-edgreen"
            : tone === "red"
            ? "text-edred"
            : tone === "gold"
            ? "text-gold"
            : tone === "purple"
            ? "text-edpurple"
            : "text-navy"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[10.5px] text-ink-subtle">{sub}</div>}
    </div>
  );
}
