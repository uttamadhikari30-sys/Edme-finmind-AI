"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

type Budget = { id: string; name: string; fiscal_year: string; status: string; created_at: string };
type BU = { id: string; code: string; name: string };
type Account = { id: string; account_code: string; account_name: string; account_type: string };
type Member = { user_id: string; email: string; full_name: string | null; role: string };

type Tab = "submissions" | "finance" | "allocation" | "consolidated" | "review";

const SCENARIOS = [60, 70, 80, 90, 100, 110, 120] as const;
type Scenario = (typeof SCENARIOS)[number];

// Plausible AOP growth from FY actuals — 9% revenue growth, 8% cost growth
const REV_GROWTH = 1.09;
const COST_GROWTH = 1.08;

// Map account codes → P&L line item & section (matches v12 layout)
function classifyAccount(code: string, type: string): { section: string; lineItem: string; isRevenue: boolean; isCost: boolean } | null {
  if (type === "revenue") {
    return { section: "REVENUE", lineItem: code, isRevenue: true, isCost: false };
  }
  if (type !== "expense") return null;
  const n = parseInt(code, 10);
  // Direct costs: salary (5000-5099), tech (5300)
  if (n >= 5000 && n <= 5099) return { section: "DIRECT COSTS", lineItem: "Salary (Direct)", isRevenue: false, isCost: true };
  if (n === 5300) return { section: "DIRECT COSTS", lineItem: "Technology", isRevenue: false, isCost: true };
  // Overheads: rent (5100), marketing (5200), travel (5400), professional (5500)
  return { section: "OVERHEADS", lineItem: code, isRevenue: false, isCost: true };
}

export default function BudgetAopClient({
  orgId,
  budgets,
  bus,
  accounts,
  members,
  fyActuals,
}: {
  orgId: string;
  budgets: Budget[];
  bus: BU[];
  accounts: Account[];
  members: Member[];
  fyActuals: Record<string, number>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const currency = useCurrency();
  const [tab, setTab] = useState<Tab>("submissions");
  const [scenario, setScenario] = useState<Scenario>(70);
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

  // Build P&L line items from accounts + fyActuals
  const lines = useMemo(() => {
    type LineRow = {
      code: string;
      label: string;
      section: string;
      isRevenue: boolean;
      isCost: boolean;
      fy25Actual: number;
      fy27AOP: number; // 100% scenario
    };
    const result: LineRow[] = [];
    accounts.forEach((a) => {
      const cls = classifyAccount(a.account_code, a.account_type);
      if (!cls) return;
      const actual = Math.abs(fyActuals[a.account_code] ?? 0);
      const aop100 = cls.isRevenue ? actual * REV_GROWTH : actual * COST_GROWTH;
      result.push({
        code: a.account_code,
        label: cls.lineItem === a.account_code ? a.account_name : cls.lineItem,
        section: cls.section,
        isRevenue: cls.isRevenue,
        isCost: cls.isCost,
        fy25Actual: actual,
        fy27AOP: aop100,
      });
    });
    return result;
  }, [accounts, fyActuals]);

  // Apply scenario % to AOP to get scenario amount
  const scenarioPct = scenario / 100;
  const linesWithScenario = lines.map((l) => {
    const scenarioAmt = l.fy27AOP * scenarioPct;
    const vsAop = (scenarioPct - 1) * 100;
    const impact = scenarioAmt - l.fy27AOP;
    return { ...l, scenarioAmt, vsAop, impact };
  });

  // Section totals
  const sumBy = (filter: (l: typeof linesWithScenario[0]) => boolean, key: keyof typeof linesWithScenario[0]) =>
    linesWithScenario.filter(filter).reduce((s, l) => s + (Number(l[key]) || 0), 0);

  const revActual = sumBy((l) => l.isRevenue, "fy25Actual");
  const revAOP = sumBy((l) => l.isRevenue, "fy27AOP");
  const revScenario = sumBy((l) => l.isRevenue, "scenarioAmt");

  const directActual = sumBy((l) => l.section === "DIRECT COSTS", "fy25Actual");
  const directAOP = sumBy((l) => l.section === "DIRECT COSTS", "fy27AOP");
  const directScenario = sumBy((l) => l.section === "DIRECT COSTS", "scenarioAmt");

  const overheadActual = sumBy((l) => l.section === "OVERHEADS", "fy25Actual");
  const overheadAOP = sumBy((l) => l.section === "OVERHEADS", "fy27AOP");
  const overheadScenario = sumBy((l) => l.section === "OVERHEADS", "scenarioAmt");

  const grossActual = revActual - directActual;
  const grossAOP = revAOP - directAOP;
  const grossScenario = revScenario - directScenario;

  const ebitdaActual = grossActual - overheadActual;
  const ebitdaAOP = grossAOP - overheadAOP;
  const ebitdaScenario = grossScenario - overheadScenario;

  const patActual = ebitdaActual > 0 ? ebitdaActual * 0.75 : ebitdaActual;
  const patAOP = ebitdaAOP > 0 ? ebitdaAOP * 0.75 : ebitdaAOP;
  const patScenario = ebitdaScenario > 0 ? ebitdaScenario * 0.75 : ebitdaScenario;

  const ebitdaMargin = revScenario > 0 ? (ebitdaScenario / revScenario) * 100 : 0;
  const grossMargin = revScenario > 0 ? (grossScenario / revScenario) * 100 : 0;
  const netMargin = revScenario > 0 ? (patScenario / revScenario) * 100 : 0;

  const scenarioTone =
    scenario >= 110 ? "purple" : scenario >= 100 ? "green" : scenario >= 90 ? "gold" : "red";
  const scenarioLabel =
    scenario >= 110 ? "Stretch" : scenario >= 100 ? "On Target" : scenario >= 90 ? "Below Target" : "Below Threshold";

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
          value={formatCurrencyLakhs(revAOP, currency)}
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

      {tab === "consolidated" && (
        <>
          {/* Achievement Scenario picker */}
          <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-800 text-white p-5 shadow-card">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <div className="text-[11px] uppercase tracking-[1.5px] font-bold text-white/50 mb-1.5">
                  Achievement Scenario
                </div>
                <div className="font-mono text-[42px] font-bold leading-none">{scenario}%</div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      scenarioTone === "green"
                        ? "bg-edgreen"
                        : scenarioTone === "gold"
                        ? "bg-gold"
                        : scenarioTone === "purple"
                        ? "bg-edpurple"
                        : "bg-edred"
                    }`}
                  />
                  <span
                    className={`font-semibold ${
                      scenarioTone === "green"
                        ? "text-edgreen"
                        : scenarioTone === "gold"
                        ? "text-gold"
                        : scenarioTone === "purple"
                        ? "text-edpurple"
                        : "text-edred"
                    }`}
                  >
                    {scenarioLabel}
                  </span>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {SCENARIOS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`px-4 py-2.5 rounded-lg text-[13px] font-bold border-2 transition min-w-[60px] ${
                      scenario === s
                        ? "border-white bg-white text-navy"
                        : "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>

              <div className="text-right min-w-[180px]">
                <div className="text-[11px] uppercase tracking-[1.5px] font-bold text-white/50 mb-1.5">
                  Projected EBITDA
                </div>
                <div
                  className={`font-mono text-[28px] font-bold leading-none ${
                    ebitdaScenario >= 0 ? "text-gold" : "text-edred"
                  }`}
                >
                  {formatCurrencyLakhs(ebitdaScenario, currency)}
                </div>
                <div className="text-[11px] text-white/60 mt-1">
                  {revScenario > 0 ? `${ebitdaMargin.toFixed(1)}% margin` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* 4 KPI summary tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <ScenKpi label="Revenue" value={formatCurrencyLakhs(revScenario, currency)} sub={`${(revScenario/Math.max(revAOP,1)*100).toFixed(1)}% of AOP`} tone="navy" emoji="💰" />
            <ScenKpi label="Gross Profit" value={formatCurrencyLakhs(grossScenario, currency)} sub={`${grossMargin.toFixed(1)}% margin`} tone="green" emoji="📈" />
            <ScenKpi label="EBITDA" value={formatCurrencyLakhs(ebitdaScenario, currency)} sub={`${ebitdaMargin.toFixed(1)}% margin`} tone="gold" emoji="🏆" />
            <ScenKpi label="PAT" value={formatCurrencyLakhs(patScenario, currency)} sub={`${netMargin.toFixed(1)}% net margin`} tone="purple" emoji="💎" />
          </div>

          {/* Scenario P&L Table */}
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="fm-table">
                  <thead>
                    <tr>
                      <th>LINE ITEM</th>
                      <th className="r">FY25 ACTUAL</th>
                      <th className="r">FY27 AOP (100%)</th>
                      <th className="r" style={{ background: "#0c1e50" }}>SCENARIO: {scenario}%</th>
                      <th className="r">VS AOP</th>
                      <th className="r">IMPACT {currency.symbol}L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue section */}
                    <SubtotalRow label="REVENUE" actual={revActual} aop={revAOP} scenario={revScenario} currency={currency} highlight />
                    {linesWithScenario.filter((l) => l.isRevenue).map((l) => (
                      <DataLine key={l.code} line={l} currency={currency} />
                    ))}

                    {/* Direct Costs */}
                    <SubtotalRow label="DIRECT COSTS" actual={directActual} aop={directAOP} scenario={directScenario} currency={currency} indent isCost />
                    {linesWithScenario.filter((l) => l.section === "DIRECT COSTS").map((l) => (
                      <DataLine key={l.code} line={l} currency={currency} />
                    ))}

                    {/* New Hire Cost (placeholder line) */}
                    <DataLine
                      key="new-hire"
                      line={{
                        code: "NEW",
                        label: "New Hire Cost",
                        section: "DIRECT COSTS",
                        isRevenue: false,
                        isCost: true,
                        fy25Actual: 0,
                        fy27AOP: revAOP * 0.02,
                        scenarioAmt: revAOP * 0.02 * scenarioPct,
                        vsAop: (scenarioPct - 1) * 100,
                        impact: revAOP * 0.02 * (scenarioPct - 1),
                      }}
                      currency={currency}
                    />

                    {/* Gross Profit */}
                    <SubtotalRow
                      label="GROSS PROFIT"
                      actual={grossActual}
                      aop={grossAOP}
                      scenario={grossScenario}
                      currency={currency}
                      highlight
                    />

                    {/* Overheads */}
                    <SubtotalRow label="OVERHEADS" actual={overheadActual} aop={overheadAOP} scenario={overheadScenario} currency={currency} indent isCost />
                    {linesWithScenario.filter((l) => l.section === "OVERHEADS").map((l) => (
                      <DataLine key={l.code} line={l} currency={currency} />
                    ))}

                    {/* Finance Overheads (placeholder) */}
                    <DataLine
                      key="finance-overheads"
                      line={{
                        code: "FOH",
                        label: "Finance Overheads",
                        section: "OVERHEADS",
                        isRevenue: false,
                        isCost: true,
                        fy25Actual: revActual * 0.05,
                        fy27AOP: revAOP * 0.05,
                        scenarioAmt: revAOP * 0.05 * scenarioPct,
                        vsAop: (scenarioPct - 1) * 100,
                        impact: revAOP * 0.05 * (scenarioPct - 1),
                      }}
                      currency={currency}
                    />

                    {/* EBITDA */}
                    <SubtotalRow
                      label="EBITDA"
                      actual={ebitdaActual}
                      aop={ebitdaAOP}
                      scenario={ebitdaScenario}
                      currency={currency}
                      emphasize
                    />

                    {/* PAT */}
                    <SubtotalRow
                      label="PAT (Estimated)"
                      actual={patActual}
                      aop={patAOP}
                      scenario={patScenario}
                      currency={currency}
                      emphasize
                    />
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}

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
                  const head = businessHeads.find((m) =>
                    (m.full_name ?? "").toLowerCase().includes(b.code.toLowerCase())
                  );
                  return (
                    <tr key={b.id}>
                      <td className="font-semibold">
                        <span className="pill pill-navy">{b.code}</span> {b.name}
                      </td>
                      <td className="text-ink-muted">{head?.full_name ?? head?.email ?? "— Unassigned —"}</td>
                      <td><span className="pill pill-gold">Pending</span></td>
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
        <Card>
          <CardHeader title="🏢 Finance Layer" tag={{ label: "Mid & Back Office Costs", tone: "navy" }} />
          <CardBody>
            <p className="text-[13px] text-ink-muted">
              Finance Layer captures mid &amp; back office costs that go through the AOP. Add cost lines and capex
              under <a href="/budget-aop" className="text-navy font-semibold hover:underline">Consolidated P&L</a> tab to see them in scenarios.
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "allocation" && (
        <Card>
          <CardHeader title="Cost Allocation Preview" tag={{ label: "From rules", tone: "purple" }} />
          <CardBody>
            <p className="text-[13px] text-ink-muted mb-3">
              Configure rules in{" "}
              <a href="/allocation-rules" className="text-navy font-semibold hover:underline">Allocation Rules</a>. They&apos;ll
              auto-distribute Finance Layer costs across verticals during P&amp;L generation.
            </p>
            <a href="/allocation-rules" className="inline-block px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-800">
              ⚙️ Open Allocation Rules →
            </a>
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

function DataLine({
  line,
  currency,
}: {
  line: {
    code: string;
    label: string;
    fy25Actual: number;
    fy27AOP: number;
    scenarioAmt: number;
    vsAop: number;
    impact: number;
    isRevenue?: boolean;
    isCost?: boolean;
  };
  currency: ReturnType<typeof useCurrency>;
}) {
  const positive = line.impact >= 0;
  // For revenue: scenario>AOP is favorable. For cost: scenario<AOP is favorable.
  const favorable = line.isRevenue ? positive : !positive;
  return (
    <tr>
      <td className="pl-6 text-ink-muted">{line.label}</td>
      <td className="r font-mono text-ink-subtle">
        {line.fy25Actual > 0 ? formatCurrencyLakhs(line.fy25Actual, currency) : "—"}
      </td>
      <td className="r font-mono text-ink-subtle">{formatCurrencyLakhs(line.fy27AOP, currency)}</td>
      <td className="r font-mono font-bold text-navy" style={{ background: "rgba(255,243,205,0.4)" }}>
        {formatCurrencyLakhs(line.scenarioAmt, currency)}
      </td>
      <td className={`r font-mono font-bold ${favorable ? "text-edgreen" : "text-edred"}`}>
        {line.vsAop >= 0 ? "+" : ""}
        {line.vsAop.toFixed(1)}%
      </td>
      <td className={`r font-mono font-bold ${favorable ? "text-edgreen" : "text-edred"}`}>
        {line.impact >= 0 ? "+" : ""}
        {compactLakhs(line.impact, currency)} {currency.symbol}L
      </td>
    </tr>
  );
}

function SubtotalRow({
  label,
  actual,
  aop,
  scenario,
  currency,
  highlight,
  emphasize,
  indent,
  isCost,
}: {
  label: string;
  actual: number;
  aop: number;
  scenario: number;
  currency: ReturnType<typeof useCurrency>;
  highlight?: boolean;
  emphasize?: boolean;
  indent?: boolean;
  isCost?: boolean;
}) {
  const vsAop = aop !== 0 ? ((scenario - aop) / Math.abs(aop)) * 100 : 0;
  const impact = scenario - aop;
  const favorable = isCost ? impact <= 0 : impact >= 0;
  return (
    <tr
      className={
        emphasize
          ? "bg-edgreen-50/60 border-y-2 border-edgreen/40 font-bold"
          : highlight
          ? "bg-navy-50/60 font-bold"
          : "bg-bg-alt font-semibold"
      }
    >
      <td className={`uppercase tracking-[1.5px] text-[11px] ${emphasize ? "text-edgreen" : "text-navy"} ${indent ? "pl-3" : ""}`}>
        {label}
      </td>
      <td className="r font-mono text-ink-muted">
        {actual > 0 ? formatCurrencyLakhs(actual, currency) : "—"}
      </td>
      <td className="r font-mono text-ink-muted">{formatCurrencyLakhs(aop, currency)}</td>
      <td className="r font-mono text-navy" style={{ background: "rgba(255,243,205,0.6)" }}>
        {formatCurrencyLakhs(scenario, currency)}
      </td>
      <td className={`r font-mono ${favorable ? "text-edgreen" : "text-edred"}`}>
        {vsAop >= 0 ? "+" : ""}
        {vsAop.toFixed(1)}%
      </td>
      <td className={`r font-mono ${favorable ? "text-edgreen" : "text-edred"}`}>
        {impact >= 0 ? "+" : ""}
        {compactLakhs(impact, currency)} {currency.symbol}L
      </td>
    </tr>
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

function ScenKpi({
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
        <div className="absolute right-3 bottom-3 text-[44px] opacity-[0.07] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-ink-subtle mb-2">{label}</div>
      <div
        className={`font-mono text-[26px] font-bold leading-none ${
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
