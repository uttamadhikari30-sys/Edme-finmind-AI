import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/save-plan
 * Body: { fiscal_year, lines: [{ client_id, product_line_id, basis,
 *          last_year_premium, planned_premium, brokerage_pct, conversion_pct, included }] }
 *
 * Saves a Business Head's AOP plan for their own vertical and a fiscal year.
 * Replaces any existing (non-frozen) lines for that vertical + FY.
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
  const role = (member as any).role as string;

  // Resolve the caller's vertical (BHs plan their own; admins may pass business_unit_id)
  const body = (await req.json()) as {
    fiscal_year?: string;
    business_unit_id?: string;
    lines?: any[];
  };
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

  // Ensure an AOP version exists for this FY (draft) and is not frozen/approved
  const { data: ver } = await supabase
    .from("aop_versions")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("fiscal_year", fy)
    .maybeSingle();
  let versionId = (ver as any)?.id as string | undefined;
  if (ver && ["frozen", "approved"].includes((ver as any).status)) {
    return NextResponse.json({ error: `AOP ${fy} is ${(ver as any).status} and locked.` }, { status: 409 });
  }
  if (!versionId) {
    const { data: created, error: verErr } = await supabase
      .from("aop_versions")
      .insert({ org_id: orgId, fiscal_year: fy, status: "draft" })
      .select("id")
      .single();
    if (verErr) return NextResponse.json({ error: verErr.message }, { status: 500 });
    versionId = (created as any).id;
  }

  // Replace this vertical's lines for the FY
  await supabase
    .from("aop_plan_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .eq("fiscal_year", fy);

  const rows = (body.lines ?? [])
    .filter((l) => l && l.included !== false)
    .map((l) => ({
      org_id: orgId,
      aop_version_id: versionId,
      fiscal_year: fy,
      business_unit_id: buId,
      client_id: l.client_id ?? null,
      product_line_id: l.product_line_id ?? null,
      basis: l.basis === "new" ? "new" : "renewal",
      last_year_premium: Number(l.last_year_premium) || 0,
      planned_premium: Number(l.planned_premium) || 0,
      brokerage_pct: Number(l.brokerage_pct) || 0,
      conversion_pct: Number(l.conversion_pct) || 100,
      included: true,
    }));

  if (rows.length) {
    const { error: insErr } = await supabase.from("aop_plan_lines").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const plannedBrokerage = rows
    .filter((r) => r.basis === "renewal" || r.conversion_pct >= 60)
    .reduce((s, r) => s + (r.planned_premium * r.brokerage_pct) / 100, 0);

  return NextResponse.json({ ok: true, lines: rows.length, planned_brokerage: plannedBrokerage });
}
