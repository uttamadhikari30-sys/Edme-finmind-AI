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
  created_at: string;
  accepted_at: string | null;
};

export default function UsersClient({
  orgId,
  isAdmin,
  members,
  invites,
}: {
  orgId: string;
  isAdmin: boolean;
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inv, setInv] = useState({ email: "", full_name: "", role: "finance" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setSuccess(null);

    const cleanEmail = inv.email.trim().toLowerCase();

    // 1. Insert the invite record (this carries the role + token)
    const { data: invite, error } = await supabase
      .from("org_invites")
      .insert({
        org_id: orgId,
        email: cleanEmail,
        full_name: inv.full_name || null,
        role: inv.role,
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
    setInv({ email: "", full_name: "", role: "finance" });
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
            title="Invite a teammate"
            tag={{ label: "Admin", tone: "purple" }}
            right={
              <button
                onClick={() => setShowInvite((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-800"
              >
                {showInvite ? "Hide form" : "+ New invite"}
              </button>
            }
          />
          {showInvite && (
            <CardBody>
              <form onSubmit={createInvite} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
                    onChange={(e) => setInv({ ...inv, role: e.target.value })}
                    className={inpCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>
                    ))}
                  </select>
                </Field>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-edred text-white px-4 py-2.5 text-sm font-semibold hover:bg-edred-600 disabled:opacity-60 shadow-soft"
                >
                  {busy ? "Sending…" : "✉ Invite & send OTP"}
                </button>
              </form>

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
                  <th>Created</th>
                  <th colSpan={3}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const link = typeof window !== "undefined"
                    ? `${window.location.origin}/accept-invite?token=${i.token}`
                    : "";
                  return (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td className="text-ink-muted">{i.full_name ?? "—"}</td>
                      <td><span className={`pill pill-${ROLE_TONE[i.role] || "navy"}`}>{i.role}</span></td>
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
