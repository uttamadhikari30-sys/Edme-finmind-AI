import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AllocationRulesClient from "@/components/allocation/allocation-rules-client";

export const dynamic = "force-dynamic";

export default async function AllocationRulesPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: rules }, { data: targets }, { data: accounts }, { data: bus }] = await Promise.all([
    supabase
      .from("allocation_rules")
      .select("*")
      .eq("org_id", orgId)
      .order("priority"),
    supabase
      .from("allocation_rule_targets")
      .select("*"),
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

  return (
    <>
      <PageHeader
        title="Allocation Rules"
        subtitle="Cost & Revenue allocation engine · Separate rule books for MIS (actuals) and Budget/AOP (planning)"
      />
      <AllocationRulesClient
        orgId={orgId}
        rules={rules ?? []}
        targets={(targets as any[]) ?? []}
        accounts={accounts ?? []}
        bus={bus ?? []}
      />
    </>
  );
}
