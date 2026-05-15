import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import CostListingClient from "@/components/cost/cost-listing-client";
import AIInsightsCard from "@/components/ai/ai-insights-card";

export const dynamic = "force-dynamic";

export default async function SalaryCostsPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: accounts }, { data: jelRows }, { data: bus }, { data: rules }, { data: targets }] =
    await Promise.all([
      supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type, cost_category, is_active")
        .eq("org_id", orgId)
        .order("account_code"),
      supabase
        .from("journal_entry_lines")
        .select(`
          debit_amount, credit_amount, account_id, business_unit_id,
          chart_of_accounts!inner(cost_category, account_type),
          journal_entries!inner(status, org_id)
        `)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.org_id", orgId),
      supabase
        .from("business_units")
        .select("id, code, name")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("code"),
      supabase
        .from("allocation_rules")
        .select("*")
        .eq("org_id", orgId)
        .eq("purpose", "mis")
        .eq("is_active", true),
      supabase.from("allocation_rule_targets").select("*"),
    ]);

  const spendByAccount = new Map<string, number>();
  (jelRows ?? []).forEach((row: any) => {
    if (row.chart_of_accounts.account_type !== "expense") return;
    const net = Number(row.debit_amount) - Number(row.credit_amount);
    spendByAccount.set(row.account_id, (spendByAccount.get(row.account_id) ?? 0) + net);
  });

  return (
    <>
      <PageHeader
        title="Salary Costs"
        subtitle="Payroll for Direct Sales · Mid Office · Support Function — allocate to verticals via rules"
      />
      <CostListingClient
        title="Salary Costs"
        subtitle="Front office (direct), Mid Office, Support Function payroll"
        emoji="👥"
        orgId={orgId}
        role={membership.role}
        filterCategories={["direct_cost", "salary_mid_office", "salary_support"]}
        accounts={(accounts as any[]) ?? []}
        spendByAccount={Object.fromEntries(spendByAccount)}
        bus={(bus as any[]) ?? []}
        rules={(rules as any[]) ?? []}
        targets={(targets as any[]) ?? []}
      />
      <div className="mt-4">
        <AIInsightsCard
          page="salary-costs"
          density="wide"
          context={{
            org: "Edme Insurance Brokers Limited",
            salary_accounts: Array.from(spendByAccount.keys()).length,
            total_salary_inr: Array.from(spendByAccount.values()).reduce((s, n) => s + n, 0),
            rule_count: (rules as any[])?.length ?? 0,
            note: "Salary cost analysis for an insurance broker. Industry benchmark: 18-25% of revenue. Mid-office should scale by policies-per-employee, not total headcount.",
          }}
        />
      </div>
    </>
  );
}
