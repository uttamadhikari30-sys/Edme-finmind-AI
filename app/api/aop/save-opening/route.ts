import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-opening
 * Body: { fiscal_year, opening: { ...balance-sheet + assumptions } }
 *
 * Finance saves the opening balance sheet + assumptions used to auto-generate
 * the AOP financial statements. Business Heads cannot edit this.
 */
const FIELDS = [
  "cash", "receivables", "other_current_assets", "fixed_assets_net",
  "payables", "other_current_liabilities", "share_capital", "reserves",
  "receivable_days", "payable_days", "depreciation_annual", "tax_rate", "capex_annual",
];

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
    return NextResponse.json({ error: "Opening balances are set by Finance." }, { status: 403 });
  }

  const body = (await req.json()) as { fiscal_year?: string; opening?: Record<string, any> };
  const fy = body.fiscal_year?.trim();
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });

  const patch: Record<string, number> = {};
  FIELDS.forEach((f) => (patch[f] = Number(body.opening?.[f]) || 0));

  const { data: existing } = await supabase
    .from("aop_opening_balances")
    .select("id")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("aop_opening_balances")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", (existing as any).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("aop_opening_balances")
      .insert({ org_id: orgId, fiscal_year: fy, ...patch });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
