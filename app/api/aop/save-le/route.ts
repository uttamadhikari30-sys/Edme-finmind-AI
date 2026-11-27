import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-le
 * Body: { fiscal_year, lines: [{ period_label, premium, brokerage_pct, conversion_pct, pipeline }] }
 *
 * A Business Head saves the Latest Estimate for their vertical's FUTURE months.
 * Replaces their existing LE lines for that vertical + FY.
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

  // Replace the LE lines for this vertical + FY
  await supabase
    .from("le_forecast_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .eq("fiscal_year", fy);

  const rows = (body.lines ?? [])
    .filter((l) => l && l.period_label && (l.premium || l.pipeline))
    .map((l) => ({
      org_id: orgId,
      fiscal_year: fy,
      business_unit_id: buId,
      period_label: String(l.period_label),
      premium: Number(l.premium) || 0,
      brokerage_pct: Number(l.brokerage_pct) || 0,
      conversion_pct: Number(l.conversion_pct) || 0,
      pipeline: Number(l.pipeline) || 0,
      entered_by: role === "bh" ? "bh" : "finance",
    }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("le_forecast_lines").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // LE committed revenue from these future months
  const leRevenue = rows.reduce(
    (s, r) => s + ((r.premium + (r.pipeline * r.conversion_pct) / 100) * r.brokerage_pct) / 100,
    0
  );
  return NextResponse.json({ ok: true, lines: rows.length, le_future_revenue: leRevenue });
}
