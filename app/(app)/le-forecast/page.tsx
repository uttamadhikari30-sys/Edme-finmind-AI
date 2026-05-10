import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import LEForecastClient from "@/components/le-forecast/le-forecast-client";

export const dynamic = "force-dynamic";

export default async function LEForecastPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

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
    </>
  );
}
