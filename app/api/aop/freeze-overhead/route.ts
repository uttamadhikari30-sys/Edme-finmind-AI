import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/freeze-overhead
 * Body: { fiscal_year, action: "freeze" | "reopen" }
 *
 * Finance freezes mid-office + back-office overhead. Once frozen, the
 * allocation is locked and each vertical's Business Head sees their FULL P&L
 * (revenue − own cost − allocated overhead). Business Heads cannot do this.
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
    return NextResponse.json({ error: "Only Finance can freeze overhead." }, { status: 403 });
  }

  const body = (await req.json()) as { fiscal_year?: string; action?: string };
  const fy = body.fiscal_year?.trim();
  const action = body.action;
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });
  if (!["freeze", "reopen"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const frozen = action === "freeze";

  const { data: existing } = await supabase
    .from("aop_overhead_status")
    .select("id")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();

  const patch = {
    frozen,
    frozen_by: frozen ? user.id : null,
    frozen_at: frozen ? new Date().toISOString() : null,
  };

  if (existing) {
    const { error } = await supabase.from("aop_overhead_status").update(patch).eq("id", (existing as any).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("aop_overhead_status")
      .insert({ org_id: orgId, fiscal_year: fy, ...patch });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, frozen });
}
