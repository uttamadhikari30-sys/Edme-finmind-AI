import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopBuilderClient, { type PlanLine } from "@/components/aop/aop-builder-client";
import CostPlannerClient, { type CostLine } from "@/components/aop/cost-planner-client";

const CONV_THRESHOLD = 60;

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

  // Committed brokerage from the saved plan (renewal always counts; new counts only ≥ 60%).
  const committedBrokerage = lines.reduce((sum, l) => {
    const counts = l.basis === "renewal" || l.conversion_pct >= CONV_THRESHOLD;
    return counts ? sum + (l.planned_premium * l.brokerage_pct) / 100 : sum;
  }, 0);

  const { data: costs } = await supabase
    .from("aop_cost_lines")
    .select("category, label, headcount, ctc_annual, amount")
    .eq("org_id", orgId)
    .eq("business_unit_id", bu.id)
    .eq("fiscal_year", PLAN_FY)
    .in("category", ["hiring", "mid_office", "back_office"]);

  const costLines: CostLine[] = (costs ?? []).map((c: any) => ({
    category: c.category,
    label: c.label ?? "",
    headcount: Number(c.headcount) || 0,
    ctc_annual: Number(c.ctc_annual) || 0,
    amount: Number(c.amount) || 0,
  }));

  return (
    <>
      <PageHeader
        title="AOP Builder"
        subtitle={`${bu.name} · Next year (${PLAN_FY}) · carried forward from ${BASIS_FY} actuals`}
      />
      <AopBuilderClient fiscalYear={PLAN_FY} basisYear={BASIS_FY} verticalName={bu.name} initialLines={lines} />

      <div className="mt-8">
        <div className="text-[15px] font-bold text-navy mb-1">Cost Plan &amp; AOP P&amp;L</div>
        <p className="text-[11.5px] text-ink-muted mb-3">
          Add your vertical's people costs. Save the client plan above first — AOP Profit uses the last saved committed brokerage.
        </p>
        <CostPlannerClient
          fiscalYear={PLAN_FY}
          verticalName={bu.name}
          committedBrokerage={committedBrokerage}
          initialLines={costLines}
        />
      </div>
    </>
  );
}
