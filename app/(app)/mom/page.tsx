import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import MoMTrackerClient from "@/components/mom/mom-tracker-client";

export const dynamic = "force-dynamic";

export default async function MoMPLPage() {
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
  const role = membership.role;

  let scopeBuId: string | null = null;
  if (role === "bh" && user) {
    const { data: myBu } = await supabase
      .from("business_units")
      .select("id")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    scopeBuId = (myBu as any)?.id ?? null;
  }

  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date, status")
    .eq("org_id", orgId)
    .order("start_date");

  const { data: monthly } = scopeBuId
    ? await supabase.rpc("fn_bu_monthly", { p_org_id: orgId, p_bu: scopeBuId })
    : await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });

  // Posted JE lines for detailed table
  const { data: lineRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_code, account_name, account_type),
      journal_entries!inner(period_id, status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  type Bucket = Record<string, Record<string, number>>;
  const revenueByAccount: Bucket = {};
  const expenseByAccount: Bucket = {};
  (lineRows ?? []).forEach((row: any) => {
    if (scopeBuId && row.business_unit_id !== scopeBuId) return;
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
    let blQuery = supabase
      .from("budget_lines")
      .select(`amount, period_id, business_unit_id, chart_of_accounts!inner(account_code, account_type)`)
      .eq("budget_id", budgets[0].id);
    if (scopeBuId) blQuery = blQuery.eq("business_unit_id", scopeBuId);
    const { data: bl } = await blQuery;
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
        subtitle={
          scopeBuId
            ? "Your vertical · Monthly Revenue & Expense Trends"
            : "Track all 12 months · Revenue & Expense Trends"
        }
      />
      <MoMTrackerClient
        periods={periods ?? []}
        monthly={(monthly as any[]) ?? []}
        monthlyBudget={monthlyBudget}
        bus={scopeBuId ? (bus ?? []).filter((b: any) => b.id === scopeBuId) : bus ?? []}
        lockVertical={!!scopeBuId}
        revenueByAccount={revenueByAccount}
        expenseByAccount={expenseByAccount}
        aopByAccount={aopByAccount}
      />
    </>
  );
}
