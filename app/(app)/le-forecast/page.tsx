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

  // Load periods
  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date")
    .eq("org_id", orgId)
    .order("start_date");

  // Load posted JE lines, joined to accounts, and bucketed by period
  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount,
      chart_of_accounts!inner(account_code, account_name, account_type),
      journal_entries!inner(period_id, status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  // Aggregate revenue lines by account + period
  type Bucket = Record<string, Record<string, number>>;
  const revenueByAccount: Bucket = {};
  const expenseByAccount: Bucket = {};

  (lines ?? []).forEach((row: any) => {
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
      />
    </>
  );
}
