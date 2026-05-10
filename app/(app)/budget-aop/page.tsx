import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import BudgetAopClient from "@/components/budget/budget-aop-client";

export const dynamic = "force-dynamic";

export default async function BudgetAopPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: budgets }, { data: bus }, { data: accounts }, { data: members }] = await Promise.all([
    supabase
      .from("budgets")
      .select("id, name, fiscal_year, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .order("code"),
    supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, account_type")
      .eq("org_id", orgId)
      .order("account_code"),
    supabase.from("v_org_members_with_email").select("*"),
  ]);

  // Pull current year actual from posted JEs
  const { data: jelRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, account_id,
      chart_of_accounts!inner(account_type, account_code, account_name),
      journal_entries!inner(status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  // Aggregate per account
  const fyActuals = new Map<string, number>();
  (jelRows ?? []).forEach((row: any) => {
    const acct = row.chart_of_accounts;
    const dr = Number(row.debit_amount);
    const cr = Number(row.credit_amount);
    const net = acct.account_type === "revenue" ? cr - dr : dr - cr;
    fyActuals.set(acct.account_code, (fyActuals.get(acct.account_code) ?? 0) + net);
  });

  return (
    <>
      <PageHeader
        title="Budget / AOP"
        subtitle="Bottom-up BH submission · Finance consolidation · CFO/CEO approval · Board ready"
      />
      <BudgetAopClient
        orgId={orgId}
        budgets={budgets ?? []}
        bus={bus ?? []}
        accounts={accounts ?? []}
        members={(members as any[]) ?? []}
        fyActuals={Object.fromEntries(fyActuals)}
      />
    </>
  );
}
