import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import DirectCostClient, { type VerticalCost } from "@/components/aop/direct-cost-client";

export const dynamic = "force-dynamic";

const PLAN_FY = "FY 2027-28";
const CONV_THRESHOLD = 60;

export default async function AopCostsPage() {
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

  // Direct costs are a Finance function — Business Heads cannot see this page.
  if ((member.role || "").toLowerCase() === "bh") redirect("/dashboard");
  const orgId = member.org_id;

  const { data: bus } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("code");

  const { data: plan } = await supabase
    .from("aop_plan_lines")
    .select("business_unit_id, planned_premium, brokerage_pct, conversion_pct, basis")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY);

  const { data: costs } = await supabase
    .from("aop_cost_lines")
    .select("business_unit_id, category, label, amount")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY);

  const brokByBu = new Map<string, number>();
  (plan ?? []).forEach((p: any) => {
    const counts = p.basis === "renewal" || Number(p.conversion_pct) >= CONV_THRESHOLD;
    if (!counts) return;
    const b = (Number(p.planned_premium) * Number(p.brokerage_pct)) / 100;
    brokByBu.set(p.business_unit_id, (brokByBu.get(p.business_unit_id) ?? 0) + b);
  });

  const peopleByBu = new Map<string, number>();
  const directByBu = new Map<string, { label: string; amount: number }[]>();
  (costs ?? []).forEach((c: any) => {
    if (c.category === "direct") {
      const arr = directByBu.get(c.business_unit_id) ?? [];
      arr.push({ label: c.label ?? "", amount: Number(c.amount) || 0 });
      directByBu.set(c.business_unit_id, arr);
    } else {
      peopleByBu.set(c.business_unit_id, (peopleByBu.get(c.business_unit_id) ?? 0) + (Number(c.amount) || 0));
    }
  });

  const verticals: VerticalCost[] = (bus ?? []).map((b: any) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    committedBrokerage: brokByBu.get(b.id) ?? 0,
    peopleCost: peopleByBu.get(b.id) ?? 0,
    directLines: directByBu.get(b.id) ?? [],
  }));

  return (
    <>
      <PageHeader
        title="Direct Costs (Finance)"
        subtitle={`${PLAN_FY} · rent, travel, utilities and other direct costs — entered per vertical by Finance`}
      />
      {verticals.length === 0 ? (
        <div className="text-[13px] text-ink-muted">No active verticals yet.</div>
      ) : (
        <DirectCostClient fiscalYear={PLAN_FY} verticals={verticals} />
      )}
    </>
  );
}
