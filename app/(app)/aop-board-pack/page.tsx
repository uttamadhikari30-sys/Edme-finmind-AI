import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import BoardPackClient, { type DeckData } from "@/components/aop/board-pack-client";
import { computeFinancials, type Opening } from "@/lib/aop-financials";

export const dynamic = "force-dynamic";

const PLAN_FY = "FY 2027-28";
const BASIS_FY = "FY 2026-27";
const CONV = 60;

const DEFAULT_OPENING: Opening = {
  cash: 0, receivables: 0, other_current_assets: 0, fixed_assets_net: 0,
  payables: 0, other_current_liabilities: 0, share_capital: 0, reserves: 0,
  receivable_days: 45, payable_days: 30, depreciation_annual: 0, tax_rate: 25, capex_annual: 0,
};

export default async function BoardPackPage() {
  await requireUser();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = (await supabase
    .from("org_members").select("org_id, role").eq("user_id", user?.id ?? "").limit(1).single()) as
    { data: { org_id: string; role: string } | null };
  if (!member) return null;
  const role = (member.role || "").toLowerCase();
  if (role === "bh") redirect("/dashboard");
  const orgId = member.org_id;

  const [{ data: bus }, { data: plan }, { data: costs }, { data: basisPol }, { data: ver }, { data: ob }] =
    await Promise.all([
      supabase.from("business_units").select("id, code, name").eq("org_id", orgId).eq("is_active", true).order("code"),
      supabase.from("aop_plan_lines").select("business_unit_id, planned_premium, brokerage_pct, conversion_pct, basis").eq("org_id", orgId).eq("fiscal_year", PLAN_FY),
      supabase.from("aop_cost_lines").select("business_unit_id, category, amount").eq("org_id", orgId).eq("fiscal_year", PLAN_FY),
      supabase.from("policies").select("business_unit_id, brokerage_amt").eq("org_id", orgId).eq("fiscal_year", BASIS_FY),
      supabase.from("aop_versions").select("status").eq("org_id", orgId).eq("fiscal_year", PLAN_FY).maybeSingle(),
      supabase.from("aop_opening_balances").select("*").eq("org_id", orgId).eq("fiscal_year", PLAN_FY).maybeSingle(),
    ]);

  const brok = new Map<string, number>();
  (plan ?? []).forEach((p: any) => {
    const counts = p.basis === "renewal" || Number(p.conversion_pct) >= CONV;
    if (counts) brok.set(p.business_unit_id, (brok.get(p.business_unit_id) ?? 0) + (Number(p.planned_premium) * Number(p.brokerage_pct)) / 100);
  });
  const bhC = new Map<string, number>(), ovh = new Map<string, number>();
  (costs ?? []).forEach((c: any) => {
    const m = c.category === "mid_office" || c.category === "back_office" ? ovh : bhC;
    m.set(c.business_unit_id, (m.get(c.business_unit_id) ?? 0) + (Number(c.amount) || 0));
  });
  const ly = new Map<string, number>();
  (basisPol ?? []).forEach((p: any) => ly.set(p.business_unit_id, (ly.get(p.business_unit_id) ?? 0) + (Number(p.brokerage_amt) || 0)));

  const verticals = (bus ?? []).map((b: any) => {
    const cb = brok.get(b.id) ?? 0;
    const cost = (bhC.get(b.id) ?? 0) + (ovh.get(b.id) ?? 0);
    const profit = cb - cost;
    const lyb = ly.get(b.id) ?? 0;
    return {
      name: `${b.code} · ${b.name}`,
      brokerage: cb, cost, profit,
      margin: cb > 0 ? (profit / cb) * 100 : 0,
      growth: lyb > 0 ? ((cb - lyb) / lyb) * 100 : 0,
    };
  });

  const tot = verticals.reduce((t, v) => ({ brokerage: t.brokerage + v.brokerage, cost: t.cost + v.cost, profit: t.profit + v.profit }), { brokerage: 0, cost: 0, profit: 0 });
  const totLy = [...ly.values()].reduce((s, x) => s + x, 0);
  const totals = {
    brokerage: tot.brokerage, cost: tot.cost, profit: tot.profit,
    margin: tot.brokerage > 0 ? (tot.profit / tot.brokerage) * 100 : 0,
    lyBrokerage: totLy, growth: totLy > 0 ? ((tot.brokerage - totLy) / totLy) * 100 : 0,
    verticals: verticals.length,
  };

  const opening: Opening = ob ? ({ ...(ob as any) } as Opening) : DEFAULT_OPENING;
  let bhCost = 0, overhead = 0;
  (costs ?? []).forEach((c: any) => {
    const amt = Number(c.amount) || 0;
    if (c.category === "mid_office" || c.category === "back_office") overhead += amt; else bhCost += amt;
  });
  const fin = computeFinancials({ revenue: tot.brokerage, bhCost, overhead }, opening);

  const deck: DeckData = {
    org: "Edme Insurance Brokers Limited",
    planFy: PLAN_FY,
    basisFy: BASIS_FY,
    status: ((ver as any)?.status as string) || "draft",
    totals,
    verticals,
    pl: { revenue: fin.pl.revenue, ebitda: fin.pl.ebitda, ebitdaMargin: fin.pl.ebitdaMargin, depreciation: fin.pl.depreciation, ebit: fin.pl.ebit, tax: fin.pl.tax, pat: fin.pl.pat, patMargin: fin.pl.patMargin },
    bs: { totalAssets: fin.bs.totalAssets, cash: fin.bs.cash, receivables: fin.bs.receivables, fixedAssets: fin.bs.fixedAssets, payables: fin.bs.payables, equity: fin.bs.shareCapital + fin.bs.reserves, check: fin.bs.check },
    cf: { operatingCF: fin.cf.operatingCF, investingCF: fin.cf.investingCF, netCash: fin.cf.netCash, closingCash: fin.cf.closingCash },
    hasFinancials: tot.brokerage > 0 && (opening.share_capital > 0 || opening.cash > 0 || opening.reserves > 0),
  };

  return (
    <>
      <PageHeader title="Board Pack" subtitle={`${PLAN_FY} · one-click board-approval deck from the AOP & financials`} />
      <BoardPackClient deck={deck} />
    </>
  );
}
