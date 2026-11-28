import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/finance/save-dp
 * Body: { op: "save" | "delete", item: {...} }
 *
 * Add / update / delete a debtor or payable. Finance/admin only.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) return NextResponse.json({ error: "No membership" }, { status: 403 });
  const orgId = (member as any).org_id as string;
  const role = ((member as any).role as string)?.toLowerCase();
  if (role === "bh") return NextResponse.json({ error: "Debtors & Payables are managed by Finance." }, { status: 403 });

  const body = (await req.json()) as { op?: string; item?: any };
  const op = body.op ?? "save";
  const it = body.item ?? {};

  if (op === "delete") {
    if (!it.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase.from("debtor_payable").delete().eq("org_id", orgId).eq("id", it.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const amount = Number(it.amount) || 0;
  const collected = Math.min(Number(it.collected) || 0, amount);
  const status = collected <= 0 ? "open" : collected >= amount ? "settled" : "partial";
  const row = {
    org_id: orgId,
    kind: it.kind === "payable" ? "payable" : "debtor",
    party: String(it.party ?? "").trim(),
    team: ["corporate", "ri", "other"].includes(it.team) ? it.team : "corporate",
    invoice_no: it.invoice_no ?? null,
    invoice_date: it.invoice_date || null,
    due_date: it.due_date || null,
    amount,
    collected,
    status,
    notes: it.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (!row.party) return NextResponse.json({ error: "Party name required" }, { status: 400 });

  if (it.id) {
    const { error } = await supabase.from("debtor_payable").update(row).eq("org_id", orgId).eq("id", it.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: it.id });
  }
  const { data, error } = await supabase.from("debtor_payable").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as any).id });
}
