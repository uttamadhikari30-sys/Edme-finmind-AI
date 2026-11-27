import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-direct-costs
 * Body: { fiscal_year, business_unit_id, lines: [{ label, amount }] }
 *
 * Finance enters a vertical's DIRECT costs (rent, utilities, travel, etc.).
 * Replaces the existing direct cost lines for that vertical + FY.
 * Business Heads cannot enter direct costs.
 */
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
  const role = ((member as any).role as string)?.toLowerCase();

  if (role === "bh") {
    return NextResponse.json({ error: "Direct costs are entered by Finance." }, { status: 403 });
  }

  const body = (await req.json()) as { fiscal_year?: string; business_unit_id?: string; lines?: any[] };
  const fy = body.fiscal_year?.trim();
  const buId = body.business_unit_id;
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });
  if (!buId) return NextResponse.json({ error: "business_unit_id required" }, { status: 400 });

  // The vertical must belong to this org
  const { data: bu } = await supabase
    .from("business_units")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", buId)
    .maybeSingle();
  if (!bu) return NextResponse.json({ error: "Unknown vertical." }, { status: 400 });

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

  // Replace the direct cost lines for this vertical + FY
  await supabase
    .from("aop_cost_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .eq("fiscal_year", fy)
    .eq("category", "direct");

  const rows = (body.lines ?? [])
    .filter((l) => l && (l.label || l.amount))
    .map((l) => ({
      org_id: orgId,
      fiscal_year: fy,
      business_unit_id: buId,
      category: "direct",
      label: l.label ?? null,
      headcount: 0,
      ctc_annual: 0,
      amount: Number(l.amount) || 0,
      entered_by: "finance",
    }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("aop_cost_lines").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  return NextResponse.json({ ok: true, lines: rows.length, total_cost: total });
}
