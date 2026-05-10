import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import PLStatementClient from "@/components/pl/pl-statement-client";

export const dynamic = "force-dynamic";

export default async function PLPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  // All periods + accounts
  const [{ data: periods }, { data: accounts }, { data: bus }] = await Promise.all([
    supabase
      .from("fiscal_periods")
      .select("id, period_label, start_date, end_date, status")
      .eq("org_id", orgId)
      .order("start_date"),
    supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, account_type")
      .eq("org_id", orgId)
      .order("account_code"),
    supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .order("code"),
  ]);

  // All posted JE lines
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(id, account_code, account_name, account_type),
      journal_entries!inner(period_id, status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  // Pre-aggregate: per account → per period → net amount
  type AmountByPeriod = Record<string, Record<string, number>>;
  const byAccount: AmountByPeriod = {};
  (lines ?? []).forEach((row: any) => {
    const acct = row.chart_of_accounts;
    const periodId = row.journal_entries.period_id;
    const dr = Number(row.debit_amount);
    const cr = Number(row.credit_amount);
    const net = acct.account_type === "revenue" ? cr - dr : dr - cr;
    byAccount[acct.id] = byAccount[acct.id] ?? {};
    byAccount[acct.id][periodId] = (byAccount[acct.id][periodId] ?? 0) + net;
  });

  // Budget lines (AOP) — to compare against
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  let budgetByAccount: AmountByPeriod = {};
  if (budgets?.[0]) {
    const { data: budgetLines } = await supabase
      .from("budget_lines")
      .select("account_id, period_id, amount")
      .eq("budget_id", budgets[0].id);
    (budgetLines ?? []).forEach((bl: any) => {
      budgetByAccount[bl.account_id] = budgetByAccount[bl.account_id] ?? {};
      budgetByAccount[bl.account_id][bl.period_id] =
        (budgetByAccount[bl.account_id][bl.period_id] ?? 0) + Number(bl.amount);
    });
  }

  return (
    <>
      <PageHeader
        title="Profit & Loss Statement"
        subtitle="Detailed P&L with Actual vs AOP, Prior Year, LE & Variance"
      />
      <PLStatementClient
        periods={periods ?? []}
        accounts={accounts ?? []}
        bus={bus ?? []}
        actualByAccount={byAccount}
        budgetByAccount={budgetByAccount}
      />
    </>
  );
}
