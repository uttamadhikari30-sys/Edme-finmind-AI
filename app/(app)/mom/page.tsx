import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import MoMTrackerClient from "@/components/mom/mom-tracker-client";

export const dynamic = "force-dynamic";

export default async function MoMPLPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date, status")
    .eq("org_id", orgId)
    .order("start_date");

  const { data: monthly } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });

  // Posted JE lines for detailed table
  const { data: lineRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount,
      chart_of_accounts!inner(account_code, account_name, account_type),
      journal_entries!inner(period_id, status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  type Bucket = Record<string, Record<string, number>>;
  const revenueByAccount: Bucket = {};
  const expenseByAccount: Bucket = {};
  (lineRows ?? []).forEach((row: any) => {
    const acct = row.chart_of_accounts;
    const periodId = row.journal_entries.period_id;
    const dr = Number(row.debit_amount);
    const cr = Number(row.credit_amount);
    if (acct.account_type === "revenue") {
      const key = `${acct.account_code}|${acct.account_name}`;
      revenueByAccount[key] = revenueByAccount[key] ?? {};
      revenueByAccount[key][periodId] = (revenueByAccount[key][periodId] ?? 0) + (cr - dr);
    } else if (acct.account_type === "expense") {
      const key = `${acct.account_code}|${acct.account_name}`;
      expenseByAccount[key] = expenseByAccount[key] ?? {};
      expenseByAccount[key][periodId] = (expenseByAccount[key][periodId] ?? 0) + (dr - cr);
    }
  });

  // AOP per account
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  const aopByAccount: Bucket = {};
  let monthlyBudget: Record<string, number> = {};
  if (budgets?.[0]) {
    const { data: bl } = await supabase
      .from("budget_lines")
      .select(`amount, period_id, chart_of_accounts!inner(account_code, account_type)`)
      .eq("budget_id", budgets[0].id);
    (bl ?? []).forEach((row: any) => {
      const code = row.chart_of_accounts.account_code;
      aopByAccount[code] = aopByAccount[code] ?? {};
      aopByAccount[code][row.period_id] = (aopByAccount[code][row.period_id] ?? 0) + Number(row.amount);
      if (row.chart_of_accounts.account_type === "revenue") {
        monthlyBudget[row.period_id] = (monthlyBudget[row.period_id] ?? 0) + Number(row.amount);
      }
    });
  }

  const { data: bus } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .order("code");

  return (
    <>
      <PageHeader
        title="Month-on-Month P&L"
        subtitle="Track all 12 months · Revenue & Expense Trends · FY 2025-26"
      />
      <MoMTrackerClient
        periods={periods ?? []}
        monthly={(monthly as any[]) ?? []}
        monthlyBudget={monthlyBudget}
        bus={bus ?? []}
        revenueByAccount={revenueByAccount}
        expenseByAccount={expenseByAccount}
        aopByAccount={aopByAccount}
      />
    </>
  );
}
