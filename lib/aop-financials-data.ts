import { createClient } from "@/lib/supabase/server";
import type { Opening, AopInputs } from "@/lib/aop-financials";

export const PLAN_FY = "FY 2027-28";
const CONV = 60;

export const DEFAULT_OPENING: Opening = {
  cash: 0, receivables: 0, other_current_assets: 0, fixed_assets_net: 0,
  payables: 0, other_current_liabilities: 0, share_capital: 0, reserves: 0,
  receivable_days: 45, payable_days: 30, depreciation_annual: 0, tax_rate: 25, capex_annual: 0,
};

export type AopFinancialsData = {
  role: string;
  isBH: boolean;
  canEdit: boolean;
  planFy: string;
  aop: AopInputs;
  opening: Opening;
  weights: number[];
};

// Shared loader for the AOP P&L / Balance Sheet / Cash Flow pages (and the
// combined view): frozen-AOP aggregates + opening balances + monthly weights.
export async function loadAopFinancials(): Promise<AopFinancialsData | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = (await supabase
    .from("org_members").select("org_id, role").eq("user_id", user?.id ?? "").limit(1).single()) as
    { data: { org_id: string; role: string } | null };
  if (!member) return null;
  const role = (member.role || "").toLowerCase();
  const orgId = member.org_id;
  const isBH = role === "bh";
  const canEdit = ["owner", "cfo", "ceo", "finance"].includes(role);

  const { data: plan } = await supabase
    .from("aop_plan_lines")
    .select("planned_premium, brokerage_pct, conversion_pct, basis")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY);
  const revenue = (plan ?? []).reduce((s: number, p: any) => {
    const counts = p.basis === "renewal" || Number(p.conversion_pct) >= CONV;
    return counts ? s + (Number(p.planned_premium) * Number(p.brokerage_pct)) / 100 : s;
  }, 0);

  const { data: costs } = await supabase
    .from("aop_cost_lines").select("category, amount").eq("org_id", orgId).eq("fiscal_year", PLAN_FY);
  let bhCost = 0, overhead = 0;
  (costs ?? []).forEach((c: any) => {
    const amt = Number(c.amount) || 0;
    if (c.category === "mid_office" || c.category === "back_office") overhead += amt;
    else if (c.category === "hiring" || c.category === "direct") bhCost += amt;
  });

  const { data: ob } = await supabase
    .from("aop_opening_balances").select("*").eq("org_id", orgId).eq("fiscal_year", PLAN_FY).maybeSingle();
  const opening: Opening = ob
    ? {
        cash: Number((ob as any).cash), receivables: Number((ob as any).receivables),
        other_current_assets: Number((ob as any).other_current_assets),
        fixed_assets_net: Number((ob as any).fixed_assets_net),
        payables: Number((ob as any).payables),
        other_current_liabilities: Number((ob as any).other_current_liabilities),
        share_capital: Number((ob as any).share_capital), reserves: Number((ob as any).reserves),
        receivable_days: Number((ob as any).receivable_days), payable_days: Number((ob as any).payable_days),
        depreciation_annual: Number((ob as any).depreciation_annual), tax_rate: Number((ob as any).tax_rate),
        capex_annual: Number((ob as any).capex_annual),
      }
    : { ...DEFAULT_OPENING };

  const { data: monthly } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
  const rev = (monthly ?? []).map((m: any) => Number(m.revenue) || 0);
  const positive = rev.filter((x: number) => x > 0);
  const avg = positive.length ? positive.reduce((s: number, x: number) => s + x, 0) / positive.length : 1;
  const weights = rev.length === 12 ? rev.map((x: number) => (x > 0 ? x : avg)) : new Array(12).fill(1 / 12);

  return { role, isBH, canEdit, planFy: PLAN_FY, aop: { revenue, bhCost, overhead }, opening, weights };
}
