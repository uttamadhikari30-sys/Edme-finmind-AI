"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  cost_category: string | null;
  is_active: boolean;
};
type Rule = {
  id: string;
  name: string;
  source_account: string | null;
  method: "direct" | "percent" | "headcount" | "revenue";
  is_active: boolean;
  priority: number;
};
type Target = { id: string; rule_id: string; business_unit_id: string; weight: number };
type BU = { id: string; code: string; name: string };

const CATEGORY_LABEL: Record<string, string> = {
  direct_revenue: "Direct Revenue",
  direct_cost: "Direct Cost (Sales)",
  admin_overhead: "Admin Overhead",
  salary_mid_office: "Salary — Mid Office",
  salary_support: "Salary — Support Function",
  capex: "Capex / Depreciation",
  finance_cost: "Finance Cost",
  tax: "Tax",
  other: "Other",
};

const CATEGORY_TONE: Record<string, "navy" | "green" | "red" | "gold" | "purple"> = {
  direct_revenue: "green",
  direct_cost: "red",
  admin_overhead: "gold",
  salary_mid_office: "navy",
  salary_support: "purple",
  capex: "gold",
  finance_cost: "red",
  tax: "red",
  other: "navy",
};

export default function CostListingClient({
  title,
  subtitle,
  emoji,
  orgId,
  role,
  filterCategories,
  accounts,
  spendByAccount,
  bus,
  rules,
  targets,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  orgId: string;
  role: string;
  filterCategories: string[];
  accounts: Account[];
  spendByAccount: Record<string, number>;
  bus: BU[];
  rules: Rule[];
  targets: Target[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrency();
  const canEdit = ["owner", "cfo", "finance"].includes(role);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((a) =>
        filterCategories.includes(a.cost_category ?? "other") && a.account_type === "expense"
      ),
    [accounts, filterCategories]
  );

  const total = filteredAccounts.reduce((s, a) => s + (spendByAccount[a.id] ?? 0), 0);

  // For each account, find a matching allocation rule
  function ruleFor(accountId: string): Rule | undefined {
    return rules.find((r) => r.source_account === accountId)
      ?? rules.find((r) => !r.source_account); // fallback: any rule that applies to "all"
  }

  // Distribute an amount across verticals based on a rule's targets
  function distribute(amount: number, rule: Rule | undefined): Record<string, number> {
    if (!rule) return {};
    const ruleTargets = targets.filter((t) => t.rule_id === rule.id);
    if (!ruleTargets.length) return {};
    if (rule.method === "percent") {
      return Object.fromEntries(
        ruleTargets.map((t) => [t.business_unit_id, amount * (Number(t.weight) / 100)])
      );
    }
    if (rule.method === "direct") {
      const first = ruleTargets[0];
      if (!first) return {};
      return { [first.business_unit_id]: amount };
    }
    // For headcount / revenue methods, weights are auto-derived elsewhere — equal-split as preview
    const equal = amount / ruleTargets.length;
    return Object.fromEntries(ruleTargets.map((t) => [t.business_unit_id, equal]));
  }

  async function setCategory(accountId: string, newCat: string) {
    await supabase.from("chart_of_accounts").update({ cost_category: newCat }).eq("id", accountId);
    router.refresh();
  }

  // Pre-compute allocation per vertical for the entire group
  const allocationByBu = new Map<string, number>();
  filteredAccounts.forEach((a) => {
    const spend = spendByAccount[a.id] ?? 0;
    if (spend === 0) return;
    const rule = ruleFor(a.id);
    const dist = distribute(spend, rule);
    Object.entries(dist).forEach(([buId, amt]) => {
      allocationByBu.set(buId, (allocationByBu.get(buId) ?? 0) + amt);
    });
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Tile label={`${title} Total`} value={formatCurrencyLakhs(total, currency)} tone="navy" emoji={emoji} />
        <Tile
          label="Accounts in scope"
          value={filteredAccounts.length}
          tone="gold"
          emoji="📂"
          sub={`${filterCategories.map((c) => CATEGORY_LABEL[c]).join(" · ")}`}
        />
        <Tile
          label="MIS Allocation Rules"
          value={rules.length}
          tone="purple"
          emoji="⚙️"
          sub={rules.length === 0 ? "No rules configured" : `${rules.filter((r) => r.is_active).length} active`}
        />
      </div>

      <Card>
        <CardHeader
          title={`${emoji} ${title} — by account`}
          tag={{ label: `${filteredAccounts.length} accounts`, tone: "navy" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Allocation Rule</th>
                  <th className="r">YTD Spend</th>
                  <th>Distribution Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ink-subtle text-sm">
                      No accounts classified in this bucket yet. Use the Category dropdown on any expense account in{" "}
                      <a href="/chart-of-accounts" className="text-navy font-semibold hover:underline">
                        Chart of Accounts
                      </a>{" "}
                      to tag it.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((a) => {
                    const spend = spendByAccount[a.id] ?? 0;
                    const rule = ruleFor(a.id);
                    const dist = distribute(spend, rule);
                    const cat = a.cost_category ?? "other";
                    return (
                      <tr key={a.id}>
                        <td className="font-mono text-[11px] text-ink-subtle">{a.account_code}</td>
                        <td className="font-semibold">{a.account_name}</td>
                        <td>
                          {canEdit ? (
                            <select
                              value={cat}
                              onChange={(e) => setCategory(a.id, e.target.value)}
                              className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11.5px] focus:border-navy outline-none"
                            >
                              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`pill pill-${CATEGORY_TONE[cat] ?? "navy"}`}>
                              {CATEGORY_LABEL[cat] ?? cat}
                            </span>
                          )}
                        </td>
                        <td className="text-[11.5px]">
                          {rule ? (
                            <span>
                              <span className="font-semibold text-navy">{rule.name}</span>{" "}
                              <span className="pill pill-gold">{rule.method}</span>
                            </span>
                          ) : (
                            <span className="text-ink-subtle">
                              No rule —{" "}
                              <a href="/allocation-rules" className="text-navy font-semibold hover:underline">
                                create
                              </a>
                            </span>
                          )}
                        </td>
                        <td className="r font-mono font-bold text-edred">
                          {spend > 0 ? formatCurrencyLakhs(spend, currency) : "—"}
                        </td>
                        <td className="text-[10.5px] text-ink-muted">
                          {Object.keys(dist).length === 0 ? (
                            <span className="text-ink-subtle">—</span>
                          ) : (
                            Object.entries(dist)
                              .map(([buId, amt]) => {
                                const bu = bus.find((b) => b.id === buId);
                                return `${bu?.code ?? "?"}: ${compactLakhs(amt, currency)}${currency.symbol}L`;
                              })
                              .join(" · ")
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {allocationByBu.size > 0 && (
        <Card>
          <CardHeader title="Vertical-level allocation summary" tag={{ label: "After rules applied", tone: "green" }} />
          <CardBody className="p-0">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Vertical</th>
                  <th className="r">Allocated cost</th>
                  <th className="r">Share %</th>
                </tr>
              </thead>
              <tbody>
                {[...allocationByBu.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([buId, amt]) => {
                    const bu = bus.find((b) => b.id === buId);
                    const share = total > 0 ? (amt / total) * 100 : 0;
                    return (
                      <tr key={buId}>
                        <td>
                          <span className="font-mono font-bold text-navy">{bu?.code ?? "?"}</span>
                        </td>
                        <td className="font-semibold">{bu?.name ?? "Unknown"}</td>
                        <td className="r font-mono font-bold text-navy">{formatCurrencyLakhs(amt, currency)}</td>
                        <td className="r font-mono text-ink-muted">{share.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        {subtitle}. Allocations use the live <a href="/allocation-rules" className="text-navy font-semibold hover:underline">MIS Allocation Rules</a> — change the rule book to re-distribute these costs across verticals.
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  emoji,
  sub,
}: {
  label: string;
  value: string | number;
  tone: "navy" | "green" | "red" | "gold" | "purple";
  emoji?: string;
  sub?: string;
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
          tone === "green" ? "text-edgreen"
          : tone === "red" ? "text-edred"
          : tone === "gold" ? "text-gold"
          : tone === "purple" ? "text-edpurple"
          : "text-navy"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[10.5px] text-ink-subtle">{sub}</div>}
    </div>
  );
}
