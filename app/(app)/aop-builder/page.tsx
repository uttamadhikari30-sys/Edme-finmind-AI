import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopBuilderClient, { type PlanLine } from "@/components/aop/aop-builder-client";

export const dynamic = "force-dynamic";

const PLAN_FY = "FY 2027-28";
const BASIS_FY = "FY 2026-27";

export default async function AopBuilderPage() {
  await requireUser();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!member) return null;
  const orgId = member.org_id;
  const role = member.role;

  let bu: { id: string; code: string; name: string } | null = null;
  if (role === "bh" && user) {
    const { data } = await supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    bu = data as any;
  } else {
    const { data } = await supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("code")
      .limit(1)
      .maybeSingle();
    bu = data as any;
  }

  if (!bu) {
    return <PageHeader title="AOP Builder" subtitle="No vertical assigned to you yet." />;
  }

  const { data: pols } = await supabase
    .from("policies")
    .select("client_id, product_line_id, premium, brokerage_pct, basis, clients(name), product_lines(code, name)")
    .eq("org_id", orgId)
    .eq("business_unit_id", bu.id)
    .eq("fiscal_year", BASIS_FY)
    .order("premium", { ascending: false });

  const { data: saved } = await supabase
    .from("aop_plan_lines")
    .select("client_id, product_line_id, planned_premium, brokerage_pct, conversion_pct, basis")
    .eq("org_id", orgId)
    .eq("business_unit_id", bu.id)
    .eq("fiscal_year", PLAN_FY);

  const savedMap = new Map<string, any>();
  (saved ?? []).forEach((s: any) => savedMap.set(`${s.client_id}|${s.product_line_id}`, s));

  const lines: PlanLine[] = (pols ?? []).map((p: any) => {
    const s = savedMap.get(`${p.client_id}|${p.product_line_id}`);
    return {
      client_id: p.client_id,
      product_line_id: p.product_line_id,
      client: p.clients?.name ?? "—",
      product: p.product_lines?.code ?? "—",
      basis: p.basis === "new" ? "new" : "renewal",
      last_year_premium: Number(p.premium),
      planned_premium: s ? Number(s.planned_premium) : Math.round((Number(p.premium) * 1.1) / 10000) * 10000,
      brokerage_pct: s ? Number(s.brokerage_pct) : Number(p.brokerage_pct),
      conversion_pct: s ? Number(s.conversion_pct) : p.basis === "new" ? 70 : 100,
      included: true,
    };
  });

  return (
    <>
      <PageHeader
        title="AOP Builder"
        subtitle={`${bu.name} · Next year (${PLAN_FY}) · carried forward from ${BASIS_FY} actuals`}
      />
      <AopBuilderClient fiscalYear={PLAN_FY} basisYear={BASIS_FY} verticalName={bu.name} initialLines={lines} />
    </>
  );
}
