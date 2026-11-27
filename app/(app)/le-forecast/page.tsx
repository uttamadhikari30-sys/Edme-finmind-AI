import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import LEForecastClient from "@/components/le-forecast/le-forecast-client";
import LeBuilderClient, { type LeMonth, type LeEntry } from "@/components/le-forecast/le-builder-client";
import AIInsightsCard from "@/components/ai/ai-insights-card";

export const dynamic = "force-dynamic";

const LE_FY = "FY 2026-27";
const MONTH_IX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export default async function LEForecastPage() {
  await requireUser();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;
  const role = (membership.role || "").toLowerCase();

  // ───────────────── Business Head: vertical-scoped LE with future-month entry ─────────────────
  if (role === "bh" && user) {
    const { data: bu } = await supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    if (!bu) return <PageHeader title="LE & Forecast" subtitle="No vertical assigned to you yet." />;
    const buId = (bu as any).id as string;

    const { data: monthly } = await supabase.rpc("fn_bu_monthly", { p_org_id: orgId, p_bu: buId });

    const now = new Date();
    const curIx = now.getFullYear() * 12 + now.getMonth();
    const months: LeMonth[] = (monthly ?? []).map((m: any) => {
      const [mon, yr] = String(m.period_label).split(" ");
      const ix = Number(yr) * 12 + (MONTH_IX[mon] ?? 0);
      return {
        label: m.period_label,
        actualRevenue: Number(m.revenue) || 0,
        actualExpense: Number(m.expense) || 0,
        isFuture: ix > curIx,
      };
    });

    const actualMonths = months.filter((m) => !m.isFuture);
    const avgExpense = actualMonths.length
      ? actualMonths.reduce((s, m) => s + m.actualExpense, 0) / actualMonths.length
      : 0;

    // AOP target = latest budget's annual revenue for this vertical
    const { data: budgets } = await supabase
      .from("budgets").select("id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1);
    let aopTarget = 0;
    if (budgets?.[0]) {
      const { data: bl } = await supabase
        .from("budget_lines")
        .select("amount, business_unit_id, chart_of_accounts!inner(account_type)")
        .eq("budget_id", budgets[0].id)
        .eq("business_unit_id", buId);
      (bl ?? []).forEach((r: any) => {
        if (r.chart_of_accounts?.account_type === "revenue") aopTarget += Number(r.amount) || 0;
      });
    }

    const { data: savedLE } = await supabase
      .from("le_forecast_lines")
      .select("period_label, premium, brokerage_pct, conversion_pct, pipeline")
      .eq("org_id", orgId)
      .eq("business_unit_id", buId)
      .eq("fiscal_year", LE_FY);
    const initialLE: Record<string, LeEntry> = {};
    (savedLE ?? []).forEach((s: any) => {
      initialLE[s.period_label] = {
        premium: Number(s.premium) || 0,
        brokerage_pct: Number(s.brokerage_pct) || 0,
        conversion_pct: Number(s.conversion_pct) || 0,
        pipeline: Number(s.pipeline) || 0,
      };
    });

    return (
      <>
        <PageHeader
          title="📈 LE & Forecast"
          subtitle={`${(bu as any).name} · ${LE_FY} · April–Nov actuals, Dec onwards Latest Estimate`}
        />
        <LeBuilderClient
          fiscalYear={LE_FY}
          verticalName={(bu as any).name}
          months={months}
          avgExpense={avgExpense}
          aopTarget={aopTarget}
          initialLE={initialLE}
        />
      </>
    );
  }
  // ───────────────── Admin / Finance: company-wide JE-based LE (existing) ─────────────────

  // Periods
  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date")
    .eq("org_id", orgId)
    .order("start_date");

  // JE lines
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_code, account_name, account_type),
      journal_entries!inner(period_id, status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  // Aggregations
  type Bucket = Record<string, Record<string, number>>;
  const revenueByAccount: Bucket = {};
  const expenseByAccount: Bucket = {};
  const revenueByBU: Record<string, Record<string, number>> = {}; // buId -> periodId -> amount

  (lines ?? []).forEach((row: any) => {
    const acct = row.chart_of_accounts;
    const periodId = row.journal_entries.period_id;
    const dr = Number(row.debit_amount);
    const cr = Number(row.credit_amount);
    if (acct.account_type === "revenue") {
      const key = `${acct.account_code}|${acct.account_name}`;
      revenueByAccount[key] = revenueByAccount[key] ?? {};
      revenueByAccount[key][periodId] = (revenueByAccount[key][periodId] ?? 0) + (cr - dr);
      const buId = row.business_unit_id;
      if (buId) {
        revenueByBU[buId] = revenueByBU[buId] ?? {};
        revenueByBU[buId][periodId] = (revenueByBU[buId][periodId] ?? 0) + (cr - dr);
      }
    } else if (acct.account_type === "expense") {
      const key = `${acct.account_code}|${acct.account_name}`;
      expenseByAccount[key] = expenseByAccount[key] ?? {};
      expenseByAccount[key][periodId] = (expenseByAccount[key][periodId] ?? 0) + (dr - cr);
    }
  });

  // Business units + their managers
  const [{ data: bus }, { data: members }, { data: budgets }] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, code, name, manager_user_id")
      .eq("org_id", orgId)
      .order("code"),
    supabase.from("v_org_members_with_email").select("user_id, full_name"),
    supabase.from("budgets").select("id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1),
  ]);

  // AOP per BU + per account
  let aopByAccount: Bucket = {};
  let aopByBU: Record<string, number> = {};
  if (budgets?.[0]) {
    const { data: bl } = await supabase
      .from("budget_lines")
      .select(`amount, account_id, business_unit_id, period_id, chart_of_accounts!inner(account_code, account_type)`)
      .eq("budget_id", budgets[0].id);
    (bl ?? []).forEach((row: any) => {
      const acctCode = row.chart_of_accounts.account_code;
      aopByAccount[acctCode] = aopByAccount[acctCode] ?? {};
      aopByAccount[acctCode][row.period_id] = (aopByAccount[acctCode][row.period_id] ?? 0) + Number(row.amount);
      if (row.business_unit_id && row.chart_of_accounts.account_type === "revenue") {
        aopByBU[row.business_unit_id] = (aopByBU[row.business_unit_id] ?? 0) + Number(row.amount);
      }
    });
  }

  // Build BU-level data with manager names
  const verticalsLE = (bus ?? []).map((b: any) => {
    const manager = (members ?? []).find((m: any) => m.user_id === b.manager_user_id);
    const buPeriods = revenueByBU[b.id] ?? {};
    return {
      id: b.id,
      bhName: manager?.full_name ?? `${b.name} Lead`,
      leRev: 0, // computed in client
      aop: aopByBU[b.id] ?? 0,
      buPeriods,
    };
  });

  return (
    <>
      <PageHeader
        title="📈 Latest Estimate — Month on Month"
        subtitle="April Actuals → Current Month Actuals → Future Months LE · Full Year View"
      />
      <LEForecastClient
        periods={periods ?? []}
        revenueByAccount={revenueByAccount}
        expenseByAccount={expenseByAccount}
        aopByAccount={aopByAccount}
        verticals={verticalsLE}
      />
      <div className="mt-4">
        <AIInsightsCard
          page="le-forecast"
          density="wide"
          context={{
            org: "Edme Insurance Brokers Limited",
            total_periods: periods?.length ?? 12,
            revenue_accounts: Object.keys(revenueByAccount).length,
            expense_accounts: Object.keys(expenseByAccount).length,
            note: "Latest Estimate for an Indian insurance broker. Forecast quality: 3-month moving average is solid. Q3 (Oct-Dec) renewals + Q4 new business = biggest upside window.",
          }}
        />
      </div>
    </>
  );
}
