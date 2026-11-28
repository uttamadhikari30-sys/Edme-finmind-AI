import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopBuilderClient, { type PlanLine } from "@/components/aop/aop-builder-client";
import CostPlannerClient, { type CostLine } from "@/components/aop/cost-planner-client";
import AIInsightsCard from "@/components/ai/ai-insights-card";

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

  // Master data: all product lines (for the add-client dropdown) and this
  // vertical's client names (to label saved lines that have no prior policy).
  const { data: productList } = await supabase
    .from("product_lines")
    .select("id, code, name, default_brokerage_pct")
    .eq("org_id", orgId)
    .order("code");
  const products = (productList ?? []).map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    brokerage_pct: Number(p.default_brokerage_pct) || 0,
  }));
  const productCode = new Map<string, string>();
  products.forEach((p) => productCode.set(p.id, p.code));

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("business_unit_id", bu.id);
  const clientName = new Map<string, string>();
  (clientRows ?? []).forEach((c: any) => clientName.set(c.id, c.name));

  const savedMap = new Map<string, any>();
  (saved ?? []).forEach((s: any) => savedMap.set(`${s.client_id}|${s.product_line_id}`, s));

  // Build lines from the UNION of last-year policies and saved plan lines, so
  // clients added straight into AOP Builder (no prior policy) still appear.
  const lineMap = new Map<string, PlanLine>();
  (pols ?? []).forEach((p: any) => {
    const key = `${p.client_id}|${p.product_line_id}`;
    const s = savedMap.get(key);
    lineMap.set(key, {
      client_id: p.client_id,
      product_line_id: p.product_line_id,
      client: p.clients?.name ?? clientName.get(p.client_id) ?? "—",
      product: p.product_lines?.code ?? productCode.get(p.product_line_id) ?? "—",
      basis: p.basis === "new" ? "new" : "renewal",
      last_year_premium: Number(p.premium),
      planned_premium: s ? Number(s.planned_premium) : Math.round((Number(p.premium) * 1.1) / 10000) * 10000,
      brokerage_pct: s ? Number(s.brokerage_pct) : Number(p.brokerage_pct),
      conversion_pct: s ? Number(s.conversion_pct) : p.basis === "new" ? 70 : 100,
      included: true,
    });
  });
  (saved ?? []).forEach((s: any) => {
    const key = `${s.client_id}|${s.product_line_id}`;
    if (lineMap.has(key)) return; // already carried from a policy
    lineMap.set(key, {
      client_id: s.client_id,
      product_line_id: s.product_line_id,
      client: clientName.get(s.client_id) ?? "—",
      product: productCode.get(s.product_line_id) ?? "—",
      basis: s.basis === "new" ? "new" : "renewal",
      last_year_premium: 0,
      planned_premium: Number(s.planned_premium),
      brokerage_pct: Number(s.brokerage_pct),
      conversion_pct: Number(s.conversion_pct),
      included: true,
    });
  });
  const lines: PlanLine[] = [...lineMap.values()];

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
    .eq("fiscal_year", PLAN_FY);

  // The BH owns hiring + direct; mid/back-office are Finance overhead (not editable here).
  const costLines: CostLine[] = (costs ?? [])
    .filter((c: any) => c.category === "hiring" || c.category === "direct")
    .map((c: any) => ({
      category: c.category,
      label: c.label ?? "",
      headcount: Number(c.headcount) || 0,
      ctc_annual: Number(c.ctc_annual) || 0,
      amount: Number(c.amount) || 0,
    }));
  const overheadCost = (costs ?? [])
    .filter((c: any) => c.category === "mid_office" || c.category === "back_office")
    .reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

  const { data: oh } = await supabase
    .from("aop_overhead_status")
    .select("frozen")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY)
    .maybeSingle();
  const overheadFrozen = !!(oh as any)?.frozen;

  // ---- AI advisor context (plan summary) ---------------------------------
  const plannedPremium = lines.reduce((s, l) => s + (l.included ? l.planned_premium : 0), 0);
  const pipelineBrok = lines.reduce((s, l) => {
    const counts = l.basis === "renewal" || l.conversion_pct >= CONV_THRESHOLD;
    return !counts && l.included ? s + (l.planned_premium * l.brokerage_pct) / 100 : s;
  }, 0);
  const lyBrok = lines.reduce((s, l) => s + (l.last_year_premium * l.brokerage_pct) / 100, 0);
  const growthPct = lyBrok > 0 ? ((committedBrokerage - lyBrok) / lyBrok) * 100 : 0;
  const myCost = costLines.reduce((s, c) => s + c.amount, 0);
  const Lk = (v: number) => +(v / 1e5).toFixed(1);
  const aiContext = {
    org: "Edme Insurance Brokers Limited",
    vertical: bu.name,
    plan_fy: PLAN_FY,
    basis_fy: BASIS_FY,
    committed_brokerage_lakh: Lk(committedBrokerage),
    planned_premium_lakh: Lk(plannedPremium),
    pipeline_brokerage_lakh: Lk(pipelineBrok),
    growth_vs_last_year_pct: +growthPct.toFixed(1),
    client_lines: lines.length,
    new_business_lines: lines.filter((l) => l.basis === "new").length,
    renewal_lines: lines.filter((l) => l.basis === "renewal").length,
    my_cost_lakh: Lk(myCost),
    overhead_frozen: overheadFrozen,
    conversion_threshold_pct: CONV_THRESHOLD,
  };

  return (
    <>
      <PageHeader
        title="AOP Builder"
        subtitle={`${bu.name} · Next year (${PLAN_FY}) · carried forward from ${BASIS_FY} actuals`}
      />
      <AopBuilderClient
        fiscalYear={PLAN_FY}
        basisYear={BASIS_FY}
        verticalName={bu.name}
        initialLines={lines}
        products={products}
      />

      <div className="mt-8">
        <div className="text-[15px] font-bold text-navy mb-1">Cost Plan &amp; AOP P&amp;L</div>
        <p className="text-[11.5px] text-ink-muted mb-3">
          Add your vertical's people costs. Save the client plan above first — AOP Profit uses the last saved committed brokerage.
        </p>
        <CostPlannerClient
          fiscalYear={PLAN_FY}
          verticalName={bu.name}
          committedBrokerage={committedBrokerage}
          overheadCost={overheadCost}
          overheadFrozen={overheadFrozen}
          initialLines={costLines}
        />
      </div>

      <div className="mt-6">
        <AIInsightsCard page="aop-builder" density="wide" title="🤖 FINMIND AOP Advisor" context={aiContext} />
      </div>
    </>
  );
}
