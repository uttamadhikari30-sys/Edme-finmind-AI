"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { id: "owner",   label: "Owner",         desc: "Full control of the workspace" },
  { id: "cfo",     label: "CFO",           desc: "Admin: full data + user management" },
  { id: "ceo",     label: "CEO",           desc: "Read-only across all data + board reports" },
  { id: "finance", label: "Finance",       desc: "Post entries, reconcile, generate reports" },
  { id: "bh",      label: "Business Head", desc: "Vertical-scoped view + AOP submission" },
  { id: "viewer",  label: "Viewer",        desc: "Read-only across the workspace" },
];

const ROLE_TONE: Record<string, "navy" | "green" | "red" | "gold"> = {
  owner: "navy",
  cfo: "navy",
  ceo: "gold",
  finance: "green",
  bh: "navy",
  viewer: "gold",
};

type Member = {
  org_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_sign_in_at: string | null;
};

type Invite = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  token: string;
  business_unit_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

type BU = {
  id: string;
  code: string;
  name: string;
  manager_user_id: string | null;
  is_active: boolean;
};

export default function UsersClient({
  orgId,
  isAdmin,
  members,
  invites,
  bus,
}: {
  orgId: string;
  isAdmin: boolean;
  members: Member[];
  invites: Invite[];
  bus: BU[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showInvite, setShowInvite] = useState(false);
  const [mode, setMode] = useState<"direct" | "invite-link">("direct");
  const [inv, setInv] = useState({
    email: "",
    full_name: "",
    role: "finance",
    business_unit_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const [directSuccess, setDirectSuccess] = useState<{
    email: string;
    full_name: string | null;
    role: string;
    temp_password: string;
    email_sent: boolean;
    email_error: string | null;
  } | null>(null);

  async function createUserDirect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSuccess(null);
    setDirectSuccess(null);

    if (inv.role === "bh" && !inv.business_unit_id) {
      setBusy(false);
      setErr("Please select a vertical for the Business Head.");
      return;
    }

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inv.email.trim().toLowerCase(),
        full_name: inv.full_name || null,
        role: inv.role,
        business_unit_id: inv.role === "bh" ? inv.business_unit_id : null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data?.error ?? "Could not create user");
      return;
    }
    setDirectSuccess({
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      temp_password: data.temp_password,
      email_sent: Boolean(data.email_sent),
      email_error: data.email_error ?? null,
    });
    setInv({ email: "", full_name: "", role: "finance", business_unit_id: "" });
    router.refresh();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSuccess(null);

    if (inv.role === "bh" && !inv.business_unit_id) {
      setBusy(false);
      setErr("Please select a vertical for the Business Head.");
      return;
    }

    const cleanEmail = inv.email.trim().toLowerCase();

    // 1. Insert the invite record (this carries role + token + optional vertical)
    const { data: invite, error } = await supabase
      .from("org_invites")
      .insert({
        org_id: orgId,
        email: cleanEmail,
        full_name: inv.full_name || null,
        role: inv.role,
        business_unit_id: inv.role === "bh" ? inv.business_unit_id : null,
      })
      .select()
      .single();

    if (error || !invite) {
      setBusy(false);
      setErr(error?.message ?? "Could not create invite");
      return;
    }

    const link = `${window.location.origin}/accept-invite?token=${invite.token}`;

    // 2. Trigger Supabase to send a one-time login email (magic link / OTP)
    //    Supabase will create the auth user on first click of the link.
    //    The link redirects to our /accept-invite page which auto-binds the role.
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: link,
        data: { full_name: inv.full_name || null },
      },
    });

    setBusy(false);
    setSuccess({
      email: cleanEmail,
      link,
      emailSent: !otpErr,
    });
    setInv({ email: "", full_name: "", role: "finance", business_unit_id: "" });
    router.refresh();
  }

  async function resendOtp(invite: Invite) {
    setBusy(true);
    setErr(null);
    const link = `${window.location.origin}/accept-invite?token=${invite.token}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: invite.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: link,
        data: { full_name: invite.full_name },
      },
    });
    setBusy(false);
    if (error) {
      setErr(`Resend failed: ${error.message}`);
    } else {
      setSuccess({ email: invite.email, link, emailSent: true });
    }
  }

  async function changeRole(member: Member, newRole: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("org_members")
      .update({ role: newRole })
      .eq("org_id", member.org_id)
      .eq("user_id", member.user_id);
    setBusy(false);
    if (error) setErr(error.message);
    router.refresh();
  }

  async function removeMember(member: Member) {
    if (!confirm(`Remove ${member.email} from the workspace?`)) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", member.org_id)
      .eq("user_id", member.user_id);
    setBusy(false);
    if (error) setErr(error.message);
    router.refresh();
  }

  async function revokeInvite(id: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("org_invites").delete().eq("id", id);
    setBusy(false);
    if (error) setErr(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="text-[12px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {isAdmin && (
        <Card>
          <CardHeader
            title="Add a teammate"
            tag={{ label: "Admin", tone: "purple" }}
            right={
              <button
                onClick={() => setShowInvite((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-800"
              >
                {showInvite ? "Hide form" : "+ New user"}
              </button>
            }
          />
          {showInvite && (
            <CardBody className="border-b border-[var(--border-2)] pb-0">
              <div className="flex gap-2 p-1 rounded-lg bg-bg-alt border border-[var(--border)] mb-4">
                <button
                  onClick={() => setMode("direct")}
                  className={`flex-1 py-2 px-3 rounded-md text-[12.5px] font-semibold transition ${
                    mode === "direct" ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
                  }`}
                >
                  🔐 Create user directly + send temp password
                </button>
                <button
                  onClick={() => setMode("invite-link")}
                  className={`flex-1 py-2 px-3 rounded-md text-[12.5px] font-semibold transition ${
                    mode === "invite-link" ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
                  }`}
                >
                  ✉️ Send invite link (user signs up)
                </button>
              </div>
            </CardBody>
          )}
          {showInvite && (
            <CardBody>
              <form
                onSubmit={mode === "direct" ? createUserDirect : createInvite}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      required
                      value={inv.email}
                      onChange={(e) => setInv({ ...inv, email: e.target.value })}
                      placeholder="teammate@edmeinsurance.com"
                      className={inpCls}
                    />
                  </Field>
                  <Field label="Full name">
                    <input
                      type="text"
                      value={inv.full_name}
                      onChange={(e) => setInv({ ...inv, full_name: e.target.value })}
                      placeholder="Optional"
                      className={inpCls}
                    />
                  </Field>
                  <Field label="Role">
                    <select
                      value={inv.role}
                      onChange={(e) =>
                        setInv({
                          ...inv,
                          role: e.target.value,
                          business_unit_id: e.target.value === "bh" ? inv.business_unit_id : "",
                        })
                      }
                      className={inpCls}
                    >
                      {ROLES.map((r) => (
                        <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Vertical selector — only shown for Business Head role */}
                {inv.role === "bh" && (
                  <div className="rounded-xl border-2 border-navy/30 bg-navy-50/40 px-4 py-3.5">
                    <div className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-navy mb-1.5">
                      🏢 Assign Vertical · <span className="text-edred">required for BH</span>
                    </div>
                    <select
                      value={inv.business_unit_id}
                      onChange={(e) => setInv({ ...inv, business_unit_id: e.target.value })}
                      required
                      className={inpCls + " mt-1"}
                    >
                      <option value="">— Select vertical —</option>
                      {bus
                        .filter((b) => b.is_active)
                        .map((b) => {
                          const taken = members.find((m) => m.user_id === b.manager_user_id);
                          return (
                            <option key={b.id} value={b.id}>
                              {b.code} · {b.name}
                              {taken ? `  (currently: ${taken.full_name ?? taken.email})` : ""}
                            </option>
                          );
                        })}
                    </select>
                    <div className="text-[10.5px] text-ink-muted mt-1.5">
                      On accept, the invitee becomes Manager of this vertical and sees only their
                      vertical&apos;s P&amp;L / performance / VPB. If the vertical already has a
                      manager, this new BH replaces them.
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-edred text-white px-5 py-2.5 text-sm font-semibold hover:bg-edred-600 disabled:opacity-60 shadow-soft"
                  >
                    {busy
                      ? mode === "direct"
                        ? "Creating…"
                        : "Sending…"
                      : mode === "direct"
                      ? "🔐 Create user & generate password"
                      : "✉ Send invite link"}
                  </button>
                </div>
              </form>

              {directSuccess && (
                <div className="mt-4 rounded-xl bg-edgreen-50 border border-edgreen/30 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{directSuccess.email_sent ? "📬" : "✅"}</span>
                    <div className="text-[13px] font-bold text-edgreen">
                      {directSuccess.email_sent
                        ? `User created — temp password emailed to ${directSuccess.email}`
                        : `User created — share these credentials with ${directSuccess.email}`}
                    </div>
                  </div>
                  {directSuccess.email_sent ? (
                    <div className="text-[11.5px] text-ink-muted mb-3 leading-relaxed">
                      The user will be <b>forced to change the password</b> on first login.
                      The temp password is also shown below as a backup in case the email is not received.
                    </div>
                  ) : directSuccess.email_error ? (
                    <div className="text-[11px] text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                      <b>Email not sent automatically.</b> {directSuccess.email_error} — share the
                      temp password manually below.
                    </div>
                  ) : null}
                  <div className="space-y-2.5 bg-white border border-edgreen/30 rounded-lg p-3 font-mono text-[12px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle w-24">Email</span>
                      <code className="flex-1">{directSuccess.email}</code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(directSuccess.email)}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-navy text-white"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle w-24">Temp Password</span>
                      <code className="flex-1 font-bold text-edred select-all">{directSuccess.temp_password}</code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(directSuccess.temp_password)}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-edred text-white"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle w-24">Login URL</span>
                      <code className="flex-1 text-[11px] truncate">
                        {typeof window !== "undefined" ? window.location.origin : ""}/login
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard?.writeText(`${window.location.origin}/login`)
                        }
                        className="text-[10px] font-bold px-2 py-1 rounded bg-navy text-white"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-ink-muted leading-relaxed">
                    ⚠ This temp password is shown <b>once</b>. Share it via WhatsApp, Teams or
                    email. The user will be <b>forced to change it</b> on first login.
                  </div>
                  <button
                    onClick={() => {
                      const msg = `Welcome to FINMIND AI!\n\nLogin URL: ${window.location.origin}/login\nEmail: ${directSuccess.email}\nTemporary password: ${directSuccess.temp_password}\n\nYou'll be asked to set your own password on first login.`;
                      navigator.clipboard?.writeText(msg);
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-edgreen text-white text-[11.5px] font-semibold hover:brightness-110"
                  >
                    📋 Copy ready-to-send message
                  </button>
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-xl bg-edgreen-50 border border-edgreen/30 px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{success.emailSent ? "📬" : "🔗"}</span>
                    <div className="text-[13px] font-bold text-edgreen">
                      {success.emailSent
                        ? `One-time login email sent to ${success.email}`
                        : `Invite created — share this link manually with ${success.email}`}
                    </div>
                  </div>
                  {success.emailSent && (
                    <div className="text-[11.5px] text-ink-muted mb-3">
                      They&apos;ll receive an email with a one-click link. Clicking it signs them in
                      and adds them to your workspace with the selected role.
                    </div>
                  )}
                  <div className="text-[10.5px] uppercase tracking-wider font-bold text-edgreen mb-1.5">
                    Backup link (valid until accepted)
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] bg-white border border-edgreen/30 rounded px-2 py-1.5 font-mono break-all">
                      {success.link}
                    </code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(success.link)}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded bg-edgreen text-white hover:brightness-110"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          )}
        </Card>
      )}

      {/* Pending invites */}
      {isAdmin && invites.length > 0 && (
        <Card>
          <CardHeader title="Pending invites" tag={{ label: `${invites.length}`, tone: "gold" }} />
          <CardBody className="p-0">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Vertical</th>
                  <th>Created</th>
                  <th colSpan={3}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const link = typeof window !== "undefined"
                    ? `${window.location.origin}/accept-invite?token=${i.token}`
                    : "";
                  const assignedBu = bus.find((b) => b.id === i.business_unit_id);
                  return (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td className="text-ink-muted">{i.full_name ?? "—"}</td>
                      <td><span className={`pill pill-${ROLE_TONE[i.role] || "navy"}`}>{i.role}</span></td>
                      <td className="text-[11.5px]">
                        {assignedBu ? (
                          <span>
                            <span className="font-mono text-navy font-bold">{assignedBu.code}</span>{" "}
                            <span className="text-ink-muted">{assignedBu.name}</span>
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="text-ink-muted">{new Date(i.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => resendOtp(i)}
                          disabled={busy}
                          className="text-[11px] text-navy font-semibold hover:underline disabled:opacity-50"
                        >
                          Resend email
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => navigator.clipboard?.writeText(link)}
                          className="text-[11px] text-navy font-semibold hover:underline"
                          title={link}
                        >
                          Copy link
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => revokeInvite(i.id)}
                          className="text-[11px] text-edred font-semibold hover:underline"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader title="Members" tag={{ label: `${members.length}`, tone: "navy" }} />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Last sign-in</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td className="font-semibold">{m.email}</td>
                  <td className="text-ink-muted">{m.full_name ?? "—"}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value)}
                        className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11.5px] focus:border-navy outline-none"
                      >
                        {ROLES.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`pill pill-${ROLE_TONE[m.role] || "navy"}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="text-ink-muted">
                    {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString() : "—"}
                  </td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => removeMember(m)} className="text-[11px] text-edred font-semibold hover:underline">
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

const inpCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
