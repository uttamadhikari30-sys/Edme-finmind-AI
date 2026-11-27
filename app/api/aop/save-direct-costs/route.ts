import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-direct-costs   (Finance overhead entry)
 * Body: { fiscal_year, business_unit_id, lines: [{ category, label, amount }] }
 *   category ∈ "mid_office" | "back_office"
 *
 * Finance enters a vertical's MID-OFFICE and BACK-OFFICE overhead.
 * Business Heads cannot see or enter these. Replaces the existing
 * mid/back-office lines for that vertical + FY. Blocked once overhead is frozen.
 */
const FINANCE_CATEGORIES = ["mid_office", "back_office"];

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
    return NextResponse.json({ error: "Overhead is entered by Finance." }, { status: 403 });
  }

  const body = (await req.json()) as { fiscal_year?: string; business_unit_id?: string; lines?: any[] };
  const fy = body.fiscal_year?.trim();
  const buId = body.business_unit_id;
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });
  if (!buId) return NextResponse.json({ error: "business_unit_id required" }, { status: 400 });

  const { data: bu } = await supabase
    .from("business_units")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", buId)
    .maybeSingle();
  if (!bu) return NextResponse.json({ error: "Unknown vertical." }, { status: 400 });

  // Once Finance freezes overhead, it is locked for all verticals.
  const { data: oh } = await supabase
    .from("aop_overhead_status")
    .select("frozen")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();
  if ((oh as any)?.frozen) {
    return NextResponse.json({ error: `Overhead for ${fy} is frozen.` }, { status: 409 });
  }

  // Replace the mid/back-office lines for this vertical + FY
  await supabase
    .from("aop_cost_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .eq("fiscal_year", fy)
    .in("category", FINANCE_CATEGORIES);

  const rows = (body.lines ?? [])
    .filter((l) => l && FINANCE_CATEGORIES.includes(l.category) && (l.label || l.amount))
    .map((l) => ({
      org_id: orgId,
      fiscal_year: fy,
      business_unit_id: buId,
      category: l.category,
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
