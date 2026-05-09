"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { id: "owner",   label: "Owner",       desc: "Full control of the workspace" },
  { id: "cfo",     label: "CFO",         desc: "Admin: full data + user management" },
  { id: "ceo",     label: "CEO",         desc: "Read-only across all data + board reports" },
  { id: "finance", label: "Finance",     desc: "Post entries, reconcile, generate reports" },
  { id: "bh",      label: "Business Head", desc: "Vertical-scoped view + AOP submission" },
  { id: "viewer",  label: "Viewer",      desc: "Read-only across the workspace" },
];

const ROLE_TONE: Record<string, string> = {
  owner: "pill-navy",
  cfo: "pill-navy",
  ceo: "pill-gold",
  finance: "pill-green",
  bh: "pill-navy",
  viewer: "pill-gold",
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
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setCreatedLink(null);
    const { data, error } = await supabase
      .from("org_invites")
      .insert({ org_id: orgId, email: inv.email.trim().toLowerCase(), full_name: inv.full_name || null, role: inv.role })
      .select()
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const link = `${window.location.origin}/accept-invite?token=${data.token}`;
    setCreatedLink(link);
    setInv({ email: "", full_name: "", role: "finance" });
    router.refresh();
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
                    placeholder="teammate@edmebrokers.com"
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
                  className="rounded-lg bg-navy text-white px-4 py-2.5 text-sm font-semibold hover:bg-navy-800 disabled:opacity-60"
                >
                  {busy ? "Creating…" : "Create invite"}
                </button>
              </form>

              {createdLink && (
                <div className="mt-4 rounded-lg bg-edgreen-50 border border-edgreen/30 px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-edgreen mb-1">
                    Invite created — share this link
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11.5px] bg-white border border-edgreen/30 rounded px-2 py-1.5 font-mono break-all">
                      {createdLink}
                    </code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(createdLink!)}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded bg-edgreen text-white hover:brightness-110"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-2">
                    Send this link to the teammate. They&apos;ll set their password and be added to your workspace
                    with the <b>{inv.role}</b> role automatically.
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
                  <th>Link</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite?token=${i.token}`;
                  return (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td className="text-ink-muted">{i.full_name ?? "—"}</td>
                      <td><span className={`pill ${ROLE_TONE[i.role] || "pill-navy"}`}>{i.role}</span></td>
                      <td className="text-ink-muted">{new Date(i.created_at).toLocaleDateString()}</td>
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
                        <button onClick={() => revokeInvite(i.id)} className="text-[11px] text-edred font-semibold hover:underline">
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
                      <span className={`pill ${ROLE_TONE[m.role] || "pill-navy"}`}>{m.role}</span>
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

const inpCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-navy focus:bg-white outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
