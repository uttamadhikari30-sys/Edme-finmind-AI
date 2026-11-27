import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reset-password
 * Body: { user_id, new_password? }
 *
 * Owner / CFO only. Resets a workspace member's password via the Supabase
 * service-role admin API. If no password is supplied a strong temp one is
 * generated. Returns the password so the admin can share it with the user.
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not configured in Vercel env vars." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: callerMember } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", caller.id)
    .limit(1)
    .maybeSingle();
  if (!callerMember || !["owner", "cfo"].includes(callerMember.role)) {
    return NextResponse.json({ error: "Only Owner / CFO can reset passwords." }, { status: 403 });
  }

  const body = (await req.json()) as { user_id?: string; new_password?: string };
  const userId = body.user_id;
  if (!userId) return NextResponse.json({ error: "user_id is required." }, { status: 400 });

  // Target must be a member of the caller's org
  const { data: target } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", callerMember.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "User is not a member of your workspace." }, { status: 404 });
  }

  const supplied = body.new_password?.trim();
  if (supplied && supplied.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const newPassword = supplied && supplied.length >= 8 ? supplied : generatePassword(10);

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: `Reset failed: ${t.slice(0, 200)}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, password: newPassword });
}

function generatePassword(length: number): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$&";
  const all = upper + lower + digits + symbols;
  const pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = pwd.length; i < length; i++) pwd.push(all[Math.floor(Math.random() * all.length)]);
  return pwd.sort(() => Math.random() - 0.5).join("");
}
