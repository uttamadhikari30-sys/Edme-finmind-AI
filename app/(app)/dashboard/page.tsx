import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import KpiCard from "@/components/kpi/kpi-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import MonthlyPLChart from "@/components/charts/monthly-pl-chart";
import { formatINR, formatPct } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";

export default async function DashboardPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, organizations(name)")
    .limit(1)
    .single();
  if (!membership) return null;

  const orgId = membership.org_id;
  const org = membership.organizations as unknown as { name: string };

  // Get current period (today's date falls in)
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

  const { data: monthlyRaw } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
  const monthly = (monthlyRaw ?? []).map((r: any) => ({
    period_label: r.period_label,
    revenue: Number(r.revenue),
    expense: Number(r.expense),
    net_income: Number(r.net_income),
  }));

  const { count: jeCount } = await supabase
    .from("journal_entries")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${org.name} · ${periodToday?.period_label ?? "No active period"} · FY 2025-26`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <KpiCard
          label="Revenue"
          value={kpis ? formatINR(Number(kpis.revenue), { compact: true }) : "—"}
          tone="navy"
          emoji="₹"
          vs="Current period"
        />
        <KpiCard
          label="Expense"
          value={kpis ? formatINR(Number(kpis.expense), { compact: true }) : "—"}
          tone="red"
          emoji="📉"
          vs="Current period"
        />
        <KpiCard
          label="Net Income"
          value={kpis ? formatINR(Number(kpis.net_income), { compact: true }) : "—"}
          tone={kpis && Number(kpis.net_income) >= 0 ? "green" : "red"}
          emoji="💎"
          vs={kpis ? `Margin ${formatPct(Number(kpis.gross_margin_pct), 1)}` : ""}
        />
        <KpiCard
          label="Journal Entries"
          value={jeCount?.toString() ?? "0"}
          tone="gold"
          emoji="📝"
          vs={kpis ? `${kpis.je_count_posted} posted · ${kpis.je_count_draft} draft` : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Revenue, Expense & Net Income — by Month" tag={{ label: "Posted only", tone: "navy" }} />
            <CardBody>
              <MonthlyPLChart data={monthly} />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="🤖 FINMIND Intelligence" tag={{ label: "AI", tone: "purple" }} />
          <CardBody>
            <div className="space-y-3">
              <Insight
                tone="info"
                title="Books status"
                body={
                  kpis
                    ? `${kpis.je_count_posted} entries posted this period — net income ${formatINR(Number(kpis.net_income), { compact: true })}.`
                    : "Set up the current fiscal period to see live insights."
                }
              />
              <Insight
                tone="good"
                title="Quick wins"
                body="Reconcile bank accounts weekly to keep your trial balance trustworthy."
              />
              <Insight
                tone="warn"
                title="Watch list"
                body={kpis && Number(kpis.expense_ratio_pct) > 80
                  ? `Expense ratio is ${formatPct(Number(kpis.expense_ratio_pct), 1)} — investigate the top expense accounts.`
                  : "Expense ratios are within healthy thresholds."}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Get started" />
        <CardBody>
          {jeCount === 0 ? (
            <EmptyState
              icon="📝"
              title="Post your first journal entry"
              body="Once you post entries, your dashboard, P&L, and variance reports will populate automatically."
              cta={{ label: "New journal entry", href: "/journal-entries/new" }}
            />
          ) : (
            <div className="text-sm text-ink-muted">
              You have {jeCount} entries on file. Visit{" "}
              <a className="text-navy font-semibold" href="/pl">P&amp;L Statement</a> or{" "}
              <a className="text-navy font-semibold" href="/variance">Variance Analysis</a> for deeper views.
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Insight({ tone, title, body }: { tone: "good" | "warn" | "info"; title: string; body: string }) {
  const styles = {
    good: "border-edgreen/20 bg-edgreen-50/40 text-edgreen",
    warn: "border-edred/20 bg-edred-50/40 text-edred",
    info: "border-navy/15 bg-navy-50/40 text-navy",
  } as const;
  return (
    <div className={`rounded-xl border p-3 ${styles[tone]}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider">{title}</div>
      <div className="text-[12px] text-ink-muted mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
