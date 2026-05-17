import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTempPasswordEmail } from "@/lib/email/send-temp-password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/create-user
 * Body: { email, full_name, role, business_unit_id? }
 *
 * 1. Verifies the caller is an org admin (owner/cfo).
 * 2. Generates a random 10-char temp password.
 * 3. Uses Supabase service-role admin API to create the user with that password.
 *    - user_metadata.must_change_password = true → forces change on first login.
 * 4. Adds them to org_members with the requested role + assigns vertical if BH.
 * 5. AUTO-EMAILS the temp password to the new user (via Resend, if RESEND_API_KEY is set).
 * 6. Returns the temp password + email-delivery status so the admin UI can show
 *    confirmation, or fall back to manual share if the email failed.
 *
 * The user is forced to change their password on first login (handled by
 * middleware.ts → /force-password-change route).
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY not configured. Add it in Vercel project env vars (Supabase Dashboard → Settings → API → service_role key).",
      },
      { status: 503 }
    );
  }

  // 1. Authenticate the caller and check they're an admin
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
    return NextResponse.json({ error: "Only Owner / CFO can create users." }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    full_name?: string;
    role?: string;
    business_unit_id?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim() ?? null;
  const role = body.role?.trim() ?? "viewer";
  const buId = body.business_unit_id || null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!["owner", "cfo", "ceo", "finance", "bh", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (role === "bh" && !buId) {
    return NextResponse.json({ error: "Business Head requires a vertical." }, { status: 400 });
  }

  // 2. Generate temp password — 10 chars, mixed case + digits + symbol
  const tempPassword = generatePassword(10);

  // 3. Create the auth user via Supabase admin API (using service_role key)
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: tempPassword,
      email_confirm: true, // skip email verification — admin is vouching
      user_metadata: {
        full_name: fullName,
        must_change_password: true,
        created_by: caller.email,
        created_at: new Date().toISOString(),
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    // Try to be helpful: if user already exists, return clean message
    if (/already (been )?registered|already exists/i.test(errText)) {
      return NextResponse.json(
        {
          error: `A user with email ${email} already exists. Use the "Members" list to change their role/vertical instead.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `Supabase create failed: ${errText.slice(0, 200)}` },
      { status: 500 }
    );
  }

  const createdUser = await createRes.json();
  const newUserId = createdUser.id as string;

  // 4. Add to org_members
  const { error: memErr } = await supabase.from("org_members").insert({
    org_id: callerMember.org_id,
    user_id: newUserId,
    role,
    full_name: fullName,
  });
  if (memErr) {
    return NextResponse.json(
      { error: `Membership insert failed: ${memErr.message}` },
      { status: 500 }
    );
  }

  // 5. Assign as vertical manager if BH
  if (role === "bh" && buId) {
    await supabase
      .from("business_units")
      .update({ manager_user_id: newUserId })
      .eq("id", buId)
      .eq("org_id", callerMember.org_id);
  }

  // 6. Auto-email the temp password to the new user.
  //    Uses the request origin so the login link matches the deployment (preview,
  //    production, or localhost). Falls back to APP_URL env var if set.
  const origin =
    process.env.APP_URL ||
    req.nextUrl.origin ||
    `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;
  const loginUrl = `${origin.replace(/\/$/, "")}/login`;

  const emailResult = await sendTempPasswordEmail({
    to: email,
    fullName,
    tempPassword,
    loginUrl,
    createdBy: caller.email ?? null,
  });

  return NextResponse.json({
    ok: true,
    user_id: newUserId,
    email,
    full_name: fullName,
    role,
    business_unit_id: buId,
    temp_password: tempPassword,
    email_sent: emailResult.sent,
    email_provider: emailResult.provider,
    email_error: emailResult.sent ? null : emailResult.reason ?? null,
    note: emailResult.sent
      ? "Temp password emailed to the user. They must change it on first login."
      : "Email delivery is not configured — share the temp password manually. The user must change it on first login.",
  });
}

function generatePassword(length: number): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$&";
  const all = upper + lower + digits + symbols;
  // Guarantee at least one of each class
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  return pwd
    .sort(() => Math.random() - 0.5)
    .join("");
}
