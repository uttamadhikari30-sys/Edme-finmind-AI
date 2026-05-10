import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import VPBClient from "@/components/vpb/vpb-client";

export const dynamic = "force-dynamic";

export default async function VPBPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: bus }, { data: members }, { data: budgets }] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, code, name, manager_user_id")
      .eq("org_id", orgId)
      .order("code"),
    supabase
      .from("v_org_members_with_email")
      .select("user_id, full_name"),
    supabase.from("budgets").select("id").eq("org_id", orgId).limit(1),
  ]);

  // Aggregate revenue / expense per BU from posted JEs
  const { data: jelRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_type),
      journal_entries!inner(status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  const byBu = new Map<string, { revenue: number; expense: number; revAOP: number }>();
  (jelRows ?? []).forEach((row: any) => {
    const buId: string | null = row.business_unit_id;
    if (!buId) return;
    const t = row.chart_of_accounts?.account_type;
    const cur = byBu.get(buId) ?? { revenue: 0, expense: 0, revAOP: 0 };
    if (t === "revenue") cur.revenue += Number(row.credit_amount) - Number(row.debit_amount);
    if (t === "expense") cur.expense += Number(row.debit_amount) - Number(row.credit_amount);
    byBu.set(buId, cur);
  });

  // AOP per BU
  if (budgets?.[0]) {
    const { data: bl } = await supabase
      .from("budget_lines")
      .select(`amount, business_unit_id, chart_of_accounts!inner(account_type)`)
      .eq("budget_id", budgets[0].id);
    (bl ?? []).forEach((row: any) => {
      if (!row.business_unit_id) return;
      if (row.chart_of_accounts.account_type === "revenue") {
        const cur = byBu.get(row.business_unit_id) ?? { revenue: 0, expense: 0, revAOP: 0 };
        cur.revAOP += Number(row.amount);
        byBu.set(row.business_unit_id, cur);
      }
    });
  }

  const verticals = (bus ?? []).map((b: any) => {
    const v = byBu.get(b.id) ?? { revenue: 0, expense: 0, revAOP: 0 };
    const manager = (members ?? []).find((m: any) => m.user_id === b.manager_user_id);
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      headName: manager?.full_name ?? `${b.name} Lead`,
      ...v,
    };
  });

  return (
    <>
      <PageHeader
        title="Variable Pay (VPB) Calculator"
        subtitle="Tier-based incentive engine · All 15 Verticals · FY 2025-26 · Click any figure to drill down"
      />
      <VPBClient verticals={verticals} />
    </>
  );
}
