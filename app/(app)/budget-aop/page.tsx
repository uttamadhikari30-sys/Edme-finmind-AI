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
    supabase
      .from("v_org_members_with_email")
      .select("*"),
  ]);

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
      />
    </>
  );
}
