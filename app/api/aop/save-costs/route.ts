import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-costs
 * Body: { fiscal_year, lines: [{ category, label, headcount, ctc_annual, amount }] }
 *
 * A Business Head saves their vertical's own cost plan: new hiring and
 * direct costs (rent, travel, etc.). Mid-office and back-office are entered
 * by Finance and are NOT visible to the Business Head.
 * Replaces the BH's existing cost lines for that vertical + FY.
 * For hiring lines, amount = headcount × ctc_annual.
 */
const BH_CATEGORIES = ["hiring", "direct"];

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No membership" }, { status: 403 });
  const orgId = (member as any).org_id as string;
  const role = (member as any).role as string;

  const body = (await req.json()) as { fiscal_year?: string; business_unit_id?: string; lines?: any[] };
  const fy = body.fiscal_year?.trim();
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });

  let buId = body.business_unit_id ?? null;
  if (role === "bh") {
    const { data: myBu } = await supabase
      .from("business_units")
      .select("id")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    buId = (myBu as any)?.id ?? null;
    if (!buId) return NextResponse.json({ error: "No vertical assigned to you." }, { status: 403 });
  } else if (!["owner", "cfo", "ceo"].includes(role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (!buId) return NextResponse.json({ error: "business_unit_id required" }, { status: 400 });

  // Guard against a frozen AOP
  const { data: ver } = await supabase
    .from("aop_versions")
    .select("status")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();
  if (ver && ["frozen", "approved"].includes((ver as any).status)) {
    return NextResponse.json({ error: `AOP ${fy} is locked.` }, { status: 409 });
  }

  // Replace the BH-owned cost categories for this vertical + FY
  await supabase
    .from("aop_cost_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .eq("fiscal_year", fy)
    .in("category", BH_CATEGORIES);

  const rows = (body.lines ?? [])
    .filter((l) => l && BH_CATEGORIES.includes(l.category) && (l.label || l.amount || l.headcount))
    .map((l) => {
      const headcount = Number(l.headcount) || 0;
      const ctc = Number(l.ctc_annual) || 0;
      const amount = l.category === "hiring" ? headcount * ctc : Number(l.amount) || 0;
      return {
        org_id: orgId,
        fiscal_year: fy,
        business_unit_id: buId,
        category: l.category,
        label: l.label ?? null,
        headcount,
        ctc_annual: ctc,
        amount,
        entered_by: "bh",
      };
    });

  if (rows.length) {
    const { error: insErr } = await supabase.from("aop_cost_lines").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  return NextResponse.json({ ok: true, lines: rows.length, total_cost: total });
}
