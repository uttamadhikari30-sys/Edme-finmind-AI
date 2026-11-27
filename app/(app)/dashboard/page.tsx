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
import KpiTicker, { type TickerItem } from "@/components/dashboard/kpi-ticker";
import PerformerBoard, { type ScoreRow } from "@/components/dashboard/performer-board";
import VerticalHeatmap from "@/components/dashboard/vertical-heatmap";
import BhTargetPopup from "@/components/dashboard/bh-target-popup";
import AIInsightsCard from "@/components/ai/ai-insights-card";
import EmptyState from "@/components/ui/empty-state";
import { formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role, full_name, organizations(name)")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single()) as { data: any };

  if (!membership) return null;
  const orgId = membership.org_id;
  const role = membership.role as string;
  const org = membership.organizations as { name: string };

  const { data: verticalsList } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("code");

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

  // Role-based scope: a Business Head sees only their own vertical.
  let scopeBU: { id: string; name: string } | null = null;
  if (role === "bh" && user) {
    const { data: bu } = await supabase
      .from("business_units")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    if (bu) scopeBU = bu as { id: string; name: string };
  }

  let kpis: any = null;
  if (periodToday) {
    if (scopeBU) {
      const { data } = await supabase.rpc("fn_bu_kpis", {
        p_org_id: orgId,
        p_period_id: periodToday.id,
        p_bu: scopeBU.id,
      });
      kpis = data?.[0] ?? null;
    } else {
      const { data } = await supabase.rpc("fn_dashboard_kpis", {
        p_org_id: orgId,
        p_period_id: periodToday.id,
      });
      kpis = data?.[0] ?? null;
    }
  }

  // Monthly trend (scoped to the BH's vertical when applicable)
  const { data: monthlyRaw } = scopeBU
    ? await supabase.rpc("fn_bu_monthly", { p_org_id: orgId, p_bu: scopeBU.id })
    : await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
  const monthly = (monthlyRaw ?? []).map((r: any) => ({
    period_label: r.period_label,
    revenue: Number(r.revenue),
    expense: Number(r.expense),
    net_income: Number(r.net_income),
  }));

  // Per-vertical scorecard (actual vs AOP) — powers admin Top/Bottom-5 + BH popup
  let scorecard: ScoreRow[] = [];
  if (periodToday) {
    const { data } = await supabase.rpc("fn_vertical_scorecard", {
      p_org_id: orgId,
      p_period_id: periodToday.id,
    });
    scorecard = (data as ScoreRow[]) ?? [];
  }
  const isCompanyView = ["owner", "cfo", "ceo"].includes(role);
  const top5 = scorecard.slice(0, 5);
  const bottom5 = scorecard.slice(-5).reverse();
  const bhRow = scopeBU ? scorecard.find((r) => r.bu_id === scopeBU!.id) ?? null : null;

  // Member count for Rev/HC
  const { count: hcCount } = await supabase
    .from("v_org_members_with_email")
    .select("*", { count: "exact", head: true });

  // P&L breakdown for waterfall
  let plRows: any[] = [];
  if (periodToday && !scopeBU) {
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

  const headcount = scopeBU ? 1 : hcCount ?? 0;
  const revPerHc = headcount > 0 ? revenue / headcount : 0;

  // Year-over-year — placeholder until we have prior-year ledger
  const yoy = 0;

  // ---- Live KPI ticker (floating numbers) --------------------------------
  const ytdRev = monthly.reduce((s: number, m: any) => s + m.revenue, 0);
  const ytdNet = monthly.reduce((s: number, m: any) => s + m.net_income, 0);
  const ytdMargin = ytdRev > 0 ? (ytdNet / ytdRev) * 100 : 0;
  const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;
  // Top scroller = YTD figures
  const tickerItems: TickerItem[] =
    revenue > 0
      ? [
          { label: "YTD Revenue", value: L(ytdRev) },
          { label: "YTD EBITDA", value: L(ytdNet), delta: `${ytdMargin.toFixed(1)}%`, up: ytdMargin >= 20 },
          { label: "YTD Margin", value: `${ytdMargin.toFixed(1)}%`, delta: "mgn", up: ytdMargin >= 20 },
          { label: "YTD PAT (Est.)", value: L(ytdNet > 0 ? ytdNet * 0.75 : ytdNet) },
          { label: "Rev / HC", value: L(revPerHc) },
          { label: "Headcount", value: `${headcount}` },
        ]
      : [];

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
    // Bottom scroller = this-month (FTM) figures
    alerts.push({ dot: "navy", text: `FTM Revenue ${L(revenue)}` });
    alerts.push({ dot: "green", text: `FTM EBITDA ${L(netIncome)}` });
    alerts.push({ dot: margin >= 25 ? "green" : "amber", text: `FTM Margin ${margin.toFixed(1)}%` });
    alerts.push({ dot: "green", text: `FTM PAT (est.) ${L(patEst)}` });
    alerts.push({
      dot: expenseRatio <= 65 ? "green" : expenseRatio <= 80 ? "amber" : "red",
      text: `Expense ratio ${expenseRatio.toFixed(1)}% (target < 65%)`,
    });
    if (kpis?.je_count_draft > 0)
      alerts.push({ dot: "amber", text: `${kpis.je_count_draft} draft entries pending` });
  } else {
    alerts.push({ dot: "navy", text: "No journal entries posted yet — load data to begin" });
  }

  // Waterfall rows from P&L
  const totalRevenue = scopeBU
    ? revenue
    : plRows.filter((r: any) => r.section === "revenue").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalExpense = scopeBU
    ? expense
    : plRows.filter((r: any) => r.section === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);
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
      {scopeBU && bhRow && (
        <BhTargetPopup row={bhRow} name={scopeBU.name} period={periodToday?.period_label ?? "this period"} />
      )}

      {scopeBU && (
        <div className="mb-4 rounded-xl border border-navy/15 bg-navy-50/50 px-4 py-2.5 flex items-center gap-2 text-[12.5px]">
          <span className="text-[15px]">🎯</span>
          <span className="text-ink-muted">
            You&apos;re viewing <b className="text-navy">{scopeBU.name}</b> — your vertical only. Company-wide
            figures are visible to CFO / CEO / Admin.
          </span>
        </div>
      )}

      <HeroStrip
        orgName={org.name}
        periodLabel={periodToday?.period_label ?? "—"}
        userName={displayName}
        revenueInr={revenue}
        ebitdaInr={netIncome}
        marginPct={margin}
        jeCount={kpis?.je_count_posted ?? 0}
      />

      {tickerItems.length > 0 && <KpiTicker items={tickerItems} />}
      <LiveAlertsRibbon alerts={alerts} />

      <DashboardControls
        periodLabel={periodToday?.period_label ?? "—"}
        verticals={
          scopeBU
            ? ((verticalsList as any[]) ?? []).filter((v) => v.id === scopeBU!.id)
            : (verticalsList as any[]) ?? []
        }
        lockVertical={!!scopeBU}
      />

      <DashboardKpisClient kpis={mainKpis} />
      <KpiSecondary kpis={secondaryKpis} />

      {isCompanyView && top5.length > 0 && <PerformerBoard top={top5} bottom={bottom5} />}

      {isCompanyView && scorecard.length > 0 && <VerticalHeatmap rows={scorecard} />}

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
          <AIInsightsCard
            page="dashboard"
            density="wide"
            context={{
              org: org.name,
              period: periodToday?.period_label,
              revenue_inr: revenue,
              expense_inr: expense,
              ebitda_inr: netIncome,
              ebitda_margin_pct: margin,
              expense_ratio_pct: expenseRatio,
              pat_est_inr: patEst,
              je_posted: kpis?.je_count_posted ?? 0,
              je_draft: kpis?.je_count_draft ?? 0,
              headcount,
              rev_per_hc_inr: revPerHc,
              currency: "INR",
              note: "Insurance broker MIS — compare to Indian insurance broking peers (25–32% EBITDA, 70% expense ratio, 22% salary-to-revenue).",
            }}
          />
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
