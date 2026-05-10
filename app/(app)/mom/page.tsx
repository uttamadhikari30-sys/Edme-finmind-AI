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

  // Optional budget for AOP comparison
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  let monthlyBudget: Record<string, number> = {};
  if (budgets?.[0]) {
    const { data: bl } = await supabase
      .from("budget_lines")
      .select(`
        amount, period_id,
        chart_of_accounts!inner(account_type)
      `)
      .eq("budget_id", budgets[0].id);
    (bl ?? []).forEach((row: any) => {
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
      />
    </>
  );
}
