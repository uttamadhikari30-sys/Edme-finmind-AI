import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import VerticalMatrixClient from "@/components/vertical/vertical-matrix-client";

export const dynamic = "force-dynamic";

export default async function VerticalPage() {
  await requireUser();
  const supabase = createClient();
  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: bus }, { data: members }] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, code, name, manager_user_id")
      .eq("org_id", orgId)
      .order("code"),
    supabase
      .from("v_org_members_with_email")
      .select("user_id, full_name, email, role"),
  ]);

  // Posted JE lines bucketed by BU + account_type
  const { data: jelRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_type),
      journal_entries!inner(status, org_id, period_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  const today = new Date().toISOString().slice(0, 10);
  const { data: currentPeriod } = await supabase
    .from("fiscal_periods")
    .select("id, period_label")
    .eq("org_id", orgId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  // Aggregate per BU
  type Aggr = { revenue: number; expense: number; revAOP: number };
  const byBu = new Map<string, Aggr>();
  (jelRows ?? []).forEach((row: any) => {
    const buId: string | null = row.business_unit_id;
    if (!buId) return;
    const t = row.chart_of_accounts?.account_type;
    const cur = byBu.get(buId) ?? { revenue: 0, expense: 0, revAOP: 0 };
    if (t === "revenue") cur.revenue += Number(row.credit_amount) - Number(row.debit_amount);
    if (t === "expense") cur.expense += Number(row.debit_amount) - Number(row.credit_amount);
    byBu.set(buId, cur);
  });

  // Optional budget (AOP) per BU for revenue
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (budgets?.[0]) {
    const { data: bl } = await supabase
      .from("budget_lines")
      .select(`
        amount, business_unit_id,
        chart_of_accounts!inner(account_type)
      `)
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
      hc: 0, // headcount per vertical — placeholder until we track it
      ...v,
    };
  });

  return (
    <>
      <PageHeader
        title="Vertical Performance Matrix"
        subtitle="All Business Heads · Revenue, EBITDA, VPB & Comparisons"
      />
      <VerticalMatrixClient
        verticals={verticals}
        currentPeriodLabel={currentPeriod?.period_label ?? "—"}
      />
    </>
  );
}
