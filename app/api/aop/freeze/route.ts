import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/freeze
 * Body: { fiscal_year, action: "freeze" | "approve" | "reopen" }
 *
 * Only the CFO / CEO / Owner (the board) can lock or reopen an AOP.
 * freeze  → status "frozen"   (BH + Finance entry blocked)
 * approve → status "approved" (final board sign-off, also locked)
 * reopen  → status "draft"    (entry re-enabled)
 */
const BOARD_ROLES = ["owner", "cfo", "ceo"];

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

  if (!BOARD_ROLES.includes(role)) {
    return NextResponse.json({ error: "Only the CFO / CEO can freeze the AOP." }, { status: 403 });
  }

  const body = (await req.json()) as { fiscal_year?: string; action?: string };
  const fy = body.fiscal_year?.trim();
  const action = body.action;
  if (!fy) return NextResponse.json({ error: "fiscal_year required" }, { status: 400 });
  if (!["freeze", "approve", "reopen"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const status = action === "freeze" ? "frozen" : action === "approve" ? "approved" : "draft";
  const locking = action !== "reopen";

  const { data: existing } = await supabase
    .from("aop_versions")
    .select("id")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();

  const patch = {
    status,
    approved_by: locking ? user.id : null,
    approved_at: locking ? new Date().toISOString() : null,
  };

  if (existing) {
    const { error } = await supabase.from("aop_versions").update(patch).eq("id", (existing as any).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("aop_versions")
      .insert({ org_id: orgId, fiscal_year: fy, ...patch });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
