import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/aop/add-client
 * Body: { client_name }
 *
 * A Business Head adds a new client to the MASTER (clients table) for their
 * own vertical, so it is available to plan in AOP Builder and shows in the
 * Customer List. Finds an existing client by name or creates it.
 * Returns { id, name, created }.
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

  const body = (await req.json()) as { client_name?: string; business_unit_id?: string };
  const name = body.client_name?.trim();
  if (!name) return NextResponse.json({ error: "Client name required" }, { status: 400 });

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

  // Find an existing client with the same name in this vertical
  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("business_unit_id", buId)
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as any).id, name: (existing as any).name, created: false });
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ org_id: orgId, business_unit_id: buId, name, status: "new" })
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: (created as any).id, name: (created as any).name, created: true });
}
