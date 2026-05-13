import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import MonthlyPLChart from "@/components/charts/monthly-pl-chart";
import DashboardControls from "@/components/dashboard/dashboard-controls";
import LiveAlertsRibbon from "@/components/dashboard/live-alerts-ribbon";
import DashboardKpisClient, { type DashKpi } from "@/components/dashboard/dashboard-kpis-client";
import KpiSecondary, { type SecondaryKpi } from "@/components/dashboard/kpi-secondary";
import PLWaterfall from "@/components/dashboard/pl-waterfall";
import HeroStrip from "@/components/dashboard/hero-strip";
import EmptyState from "@/components/ui/empty-state";
import { formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, full_name, organizations(name)")
    .limit(1)
    .single()) as { data: any };

  if (!membership) return null;
  const orgId = membership.org_id;
  const org = membership.organizations as { name: string };

  const { data: verticalsList } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("code");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName =
    (membership.full_name as string | null) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Team";

  // Current period
  const today = new Date().toISOString().slice(0, 10);
  const { data: periodToday } = await supabase
    .from("fiscal_periods")
    .select("id, period_label")
    .eq("org_id", orgId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  let kpis: any = null;
  if (periodToday) {
    const { data } = await supabase.rpc("fn_dashboard_kpis", {
      p_org_id: orgId,
      p_period_id: periodToday.id,
    });
    kpis = data?.[0] ?? null;
  }

  // Monthly trend
  const { data: monthlyRaw } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
  const monthly = (monthlyRaw ?? []).map((r: any) => ({
    period_label: r.period_label,
    revenue: Number(r.revenue),
    expense: Number(r.expense),
    net_income: Number(r.net_income),
  }));

  // Member count for Rev/HC
  const { count: hcCount } = await supabase
    .from("v_org_members_with_email")
    .select("*", { count: "exact", head: true });

  // P&L breakdown for waterfall
  let plRows: any[] = [];
  if (periodToday) {
    const { data } = await supabase.rpc("fn_pl_statement", {
      p_org_id: orgId,
      p_period_id: periodToday.id,
    });
    plRows = data ?? [];
  }

  const revenue = Number(kpis?.revenue ?? 0);
  const expense = Number(kpis?.expense ?? 0);
  const netIncome = Number(kpis?.net_income ?? 0);
  const margin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (expense / revenue) * 100 : 0;

  // Estimated PAT (assume 25% effective tax)
  const patEst = netIncome > 0 ? netIncome * 0.75 : netIncome;

  const headcount = hcCount ?? 0;
  const revPerHc = headcount > 0 ? revenue / headcount : 0;

  // Year-over-year — placeholder until we have prior-year ledger
  const yoy = 0;

  // ---- Build KPI grids ----------------------------------------------------
  const mainKpis: DashKpi[] = [
    {
      label: "Revenue",
      inrValue: revenue,
      tone: "navy",
      emoji: "💰",
      sub: revenue > 0 ? "Posted YTD" : "No entries yet",
    },
    {
      label: "EBITDA",
      inrValue: netIncome,
      tone: netIncome >= 0 ? "green" : "red",
      emoji: "📈",
      sub: revenue > 0 ? `${formatPct(margin, 1)} of revenue` : "—",
    },
    {
      label: "EBITDA Margin",
      inrValue: 0,
      rawDisplay: revenue > 0 ? `${margin.toFixed(1)}%` : "—",
      tone: margin >= 20 ? "green" : margin >= 10 ? "gold" : "red",
      emoji: "📊",
      sub: revenue > 0 ? "Live · this period" : "—",
    },
    {
      label: "PAT (Est.)",
      inrValue: patEst,
      tone: patEst >= 0 ? "navy" : "red",
      emoji: "🏆",
      sub: "After 25% tax estimate",
    },
    {
      label: "Rev / HC",
      inrValue: revPerHc,
      rawDisplay: revPerHc > 0 ? undefined : "—",
      tone: "purple",
      emoji: "👥",
      sub: `${headcount} ${headcount === 1 ? "person" : "people"}`,
    },
  ];

  const secondaryKpis: SecondaryKpi[] = [
    {
      label: "Expense Ratio",
      value: revenue > 0 ? `${expenseRatio.toFixed(1)}%` : "—",
      sub: "Target: < 65%",
      tone: expenseRatio > 80 ? "red" : expenseRatio > 65 ? "gold" : "green",
    },
    { label: "VPB Tier", value: "—", sub: "Set up VPB engine", tone: "purple" },
    { label: "VPB Earned", value: "—", sub: "Set up VPB engine", tone: "purple" },
    {
      label: "YOY Revenue",
      value: yoy ? formatPct(yoy, 1) : "—",
      sub: yoy ? "vs prior year" : "Need prior FY data",
      tone: "gold",
    },
  ];

  // Live alerts — computed from real numbers
  const alerts: { dot: "amber" | "green" | "red" | "navy"; text: string }[] = [];
  if (revenue > 0) {
    if (margin > 0) alerts.push({ dot: "green", text: `EBITDA margin ${margin.toFixed(1)}%` });
    if (expenseRatio > 80)
      alerts.push({ dot: "red", text: `Expense ratio at ${expenseRatio.toFixed(1)}% — review needed` });
    if (kpis?.je_count_draft > 0)
      alerts.push({ dot: "amber", text: `${kpis.je_count_draft} draft entries pending` });
  } else {
    alerts.push({ dot: "navy", text: "No journal entries posted yet — load data to begin" });
  }

  // Waterfall rows from P&L
  const totalRevenue = plRows
    .filter((r: any) => r.section === "revenue")
    .reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalExpense = plRows
    .filter((r: any) => r.section === "expense")
    .reduce((s: number, r: any) => s + Number(r.amount), 0);
  const grossProfit = totalRevenue - totalExpense;

  const waterfallRows = [
    { label: "Revenue", value: totalRevenue, pct: 100, tone: "navy" as const, isTotal: true },
    {
      label: "− Total Expense",
      value: -totalExpense,
      pct: totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0,
      tone: "red" as const,
    },
    {
      label: "EBITDA",
      value: grossProfit,
      pct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      tone: grossProfit >= 0 ? ("green" as const) : ("red" as const),
      isTotal: true,
    },
    {
      label: "− Tax (Est. 25%)",
      value: grossProfit > 0 ? -grossProfit * 0.25 : 0,
      pct: grossProfit > 0 ? 25 : 0,
      tone: "gold" as const,
    },
    {
      label: "PAT",
      value: patEst,
      pct: totalRevenue > 0 ? (patEst / totalRevenue) * 100 : 0,
      tone: patEst >= 0 ? ("green" as const) : ("red" as const),
      isTotal: true,
    },
  ];

  return (
    <>
      <HeroStrip
        orgName={org.name}
        periodLabel={periodToday?.period_label ?? "—"}
        userName={displayName}
        revenueInr={revenue}
        ebitdaInr={netIncome}
        marginPct={margin}
        jeCount={kpis?.je_count_posted ?? 0}
      />

      <DashboardControls
        periodLabel={periodToday?.period_label ?? "—"}
        verticals={(verticalsList as any[]) ?? []}
      />

      <LiveAlertsRibbon alerts={alerts} />

      <DashboardKpisClient kpis={mainKpis} />
      <KpiSecondary kpis={secondaryKpis} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              title="Revenue & Expense Trend"
              tag={{ label: "Posted only", tone: "navy" }}
            />
            <CardBody>
              <p className="text-[10.5px] text-ink-subtle mb-3 -mt-1">
                Monthly · Actuals (AOP / PY layers come once budget data loads)
              </p>
              <MonthlyPLChart data={monthly} />
            </CardBody>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <PLWaterfall rows={waterfallRows} periodLabel={periodToday?.period_label ?? "—"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="🤖 FINMIND Intelligence — Maya"
              tag={{ label: "AI", tone: "purple" }}
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Insight
                  tone="info"
                  title="Books Status"
                  body={
                    kpis
                      ? `${kpis.je_count_posted ?? 0} entries posted · ${kpis.je_count_draft ?? 0} drafts`
                      : "No entries yet — load demo data or post your first entry."
                  }
                />
                <Insight
                  tone={margin >= 20 ? "good" : margin >= 10 ? "info" : "warn"}
                  title="Margin Health"
                  body={
                    revenue > 0
                      ? `Net margin sitting at ${margin.toFixed(1)}% on ${formatINRUnit(revenue)} revenue.`
                      : "Pending data."
                  }
                />
                <Insight
                  tone={expenseRatio > 80 ? "warn" : "good"}
                  title="Cost Discipline"
                  body={
                    revenue > 0
                      ? `Expense ratio is ${expenseRatio.toFixed(1)}% — ${
                          expenseRatio > 80 ? "above" : "within"
                        } healthy thresholds.`
                      : "Pending data."
                  }
                />
              </div>
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Get Started" />
          <CardBody>
            {revenue > 0 ? (
              <div className="text-[12.5px] text-ink-muted leading-relaxed">
                You have <b>{kpis.je_count_posted}</b> posted entries this period. Drill into{" "}
                <a className="text-navy font-semibold hover:underline" href="/pl">P&amp;L</a>,{" "}
                <a className="text-navy font-semibold hover:underline" href="/cash-flow">Cash Flow</a> or{" "}
                <a className="text-navy font-semibold hover:underline" href="/variance">Variance</a> for deeper analysis.
              </div>
            ) : (
              <EmptyState
                icon="📝"
                title="No data yet"
                body="Post a journal entry or load the demo seed SQL to populate this dashboard."
                cta={{ label: "New journal entry", href: "/journal-entries/new" }}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Insight({
  tone,
  title,
  body,
}: {
  tone: "good" | "warn" | "info";
  title: string;
  body: string;
}) {
  const styles = {
    good: "border-edgreen/25 bg-edgreen-50/50",
    warn: "border-edred/25 bg-edred-50/50",
    info: "border-navy/15 bg-navy-50/40",
  } as const;
  const labelColor = {
    good: "text-edgreen",
    warn: "text-edred",
    info: "text-navy",
  } as const;
  return (
    <div className={`rounded-xl border p-3 ${styles[tone]}`}>
      <div className={`text-[10.5px] font-bold uppercase tracking-wider ${labelColor[tone]}`}>
        {title}
      </div>
      <div className="text-[11.5px] text-ink-muted mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
