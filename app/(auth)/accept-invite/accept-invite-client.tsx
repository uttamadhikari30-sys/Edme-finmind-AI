"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Stage =
  | "loading"
  | "set-password" // authenticated via magic link — first-time password setup
  | "manual-signup" // no auth — needs email+password signup
  | "success";

export default function AcceptInviteClient() {
  const router = useRouter();
  const supabase = createClient();

  const [stage, setStage] = useState<Stage>("loading");
  const [token, setToken] = useState("");
  const [emailKnown, setEmailKnown] = useState<string>("");
  const [invitePreview, setInvitePreview] = useState<{
    email: string;
    full_name: string | null;
    role: string;
    business_unit_label: string | null;
    org_name: string | null;
  } | null>(null);

  // Manual-signup form (when no auth)
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPwd, setSignupPwd] = useState("");

  // Set-password form (when authenticated via magic link)
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ── On mount: detect token, exchange Supabase auth code (if present), load invite preview ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("token") ?? "";
      setToken(t);

      // Some magic links arrive with auth code/hash params Supabase needs to consume.
      // Calling getSession() forces the SDK to parse them.
      await supabase.auth.getSession();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Try to load invite preview (so user sees what they're accepting)
      if (t) {
        const { data: invite } = await supabase
          .from("org_invites")
          .select(`
            email, full_name, role, accepted_at,
            organizations(name),
            business_units(code, name)
          `)
          .eq("token", t)
          .maybeSingle();

        if (invite) {
          const inv = invite as any;
          if (inv.accepted_at) {
            setError(
              "This invite has already been accepted. If that wasn't you, contact your admin to revoke and re-issue."
            );
          }
          setInvitePreview({
            email: inv.email,
            full_name: inv.full_name,
            role: inv.role,
            business_unit_label: inv.business_units
              ? `${inv.business_units.code} · ${inv.business_units.name}`
              : null,
            org_name: inv.organizations?.name ?? null,
          });
          if (!user) setSignupEmail(inv.email);
          if (!user && inv.full_name) setSignupName(inv.full_name);
        }
      }

      if (user) {
        setEmailKnown(user.email ?? "");
        setStage("set-password");
      } else {
        setStage("manual-signup");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit handlers ─────────────────────────────────────────────────────
  async function submitSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);

    // 1. Set the password on the already-authenticated account
    const { error: pwdErr } = await supabase.auth.updateUser({ password });
    if (pwdErr) {
      setLoading(false);
      return setError(pwdErr.message);
    }

    // 2. Accept the invite (binds role + vertical via fn_accept_invite RPC)
    const { error: acceptErr } = await supabase.rpc("fn_accept_invite", { p_token: token });
    setLoading(false);
    if (acceptErr) return setError(acceptErr.message);

    setStage("success");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1400);
  }

  async function submitManualSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPwd,
      options: {
        data: { full_name: signupName },
        emailRedirectTo: `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`,
      },
    });

    if (error) {
      // Already-registered fallback → sign in instead
      if (/already registered|already exists/i.test(error.message)) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: signupPwd,
        });
        if (signInErr) {
          setLoading(false);
          return setError(signInErr.message);
        }
      } else {
        setLoading(false);
        return setError(error.message);
      }
    }

    if (data?.session || (await supabase.auth.getUser()).data.user) {
      const { error: acceptErr } = await supabase.rpc("fn_accept_invite", { p_token: token });
      setLoading(false);
      if (acceptErr) return setError(acceptErr.message);
      setStage("success");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1400);
    } else {
      setLoading(false);
      setInfo(
        `Check your inbox at ${signupEmail}. Click the confirmation link and you'll land back here to finish.`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-card border border-[var(--border)] p-9 animate-fade-up">
      <div className="text-center">
        <Image
          src="/edme-logo.png"
          alt="Edme"
          width={120}
          height={36}
          priority
          style={{ height: "30px", width: "auto" }}
          className="mx-auto"
        />
        <h1 className="mt-4 font-serif text-[24px] font-bold text-navy">
          {stage === "success" ? "🎉 You're in!" : "Welcome to FINMIND AI"}
        </h1>
        <p className="text-[13px] text-ink-muted mt-1">
          {stage === "success"
            ? "Taking you to your dashboard…"
            : invitePreview
            ? `${invitePreview.org_name ?? "Edme Insurance Brokers Limited"}`
            : "Set up your account to get started."}
        </p>
      </div>

      {/* Invite preview card */}
      {invitePreview && stage !== "success" && (
        <div className="mt-5 rounded-xl bg-navy-50/50 border border-navy/15 px-4 py-3 text-[12px] space-y-1.5">
          <PreviewRow label="Inviting" value={invitePreview.email} />
          {invitePreview.full_name && <PreviewRow label="Name" value={invitePreview.full_name} />}
          <PreviewRow
            label="Role"
            value={
              <span className="pill pill-navy uppercase">{invitePreview.role}</span>
            }
          />
          {invitePreview.business_unit_label && (
            <PreviewRow
              label="Vertical"
              value={
                <span className="font-mono font-bold text-navy">
                  {invitePreview.business_unit_label}
                </span>
              }
            />
          )}
        </div>
      )}

      {/* SUCCESS state */}
      {stage === "success" && (
        <div className="mt-6 rounded-xl bg-edgreen-50 border border-edgreen/30 px-4 py-5 text-center">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-[13px] font-bold text-edgreen">
            Account ready. Redirecting to your dashboard…
          </div>
        </div>
      )}

      {/* SET PASSWORD (post-magic-link) */}
      {stage === "set-password" && (
        <form onSubmit={submitSetPassword} className="mt-6 space-y-4">
          <div className="rounded-lg bg-edgreen-50 border border-edgreen/30 px-3 py-2 text-[11.5px] text-edgreen font-semibold">
            ✓ Email verified · {emailKnown}
          </div>
          <p className="text-[12px] text-ink-muted">
            Set a password so you can sign in directly next time. (You can keep using email links
            too — this just unlocks the password option.)
          </p>

          <div>
            <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
              New password
            </label>
            <div className="relative mt-1.5">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 pr-10 text-sm focus:border-navy focus:bg-white outline-none"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle text-[13px] px-1"
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
              Confirm password
            </label>
            <input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
              placeholder="Re-enter password"
            />
          </div>

          {error && (
            <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full rounded-lg text-white font-semibold text-sm py-3 transition disabled:opacity-60 hover:brightness-110 shadow-[0_8px_24px_rgba(237,27,47,0.35)]"
            style={{ background: "linear-gradient(135deg,#ED1B2F 0%,#b8101f 100%)" }}
          >
            {loading ? "Setting up…" : "Set password & enter FINMIND AI →"}
          </button>
        </form>
      )}

      {/* MANUAL SIGNUP (no auth yet) */}
      {stage === "manual-signup" && (
        <form onSubmit={submitManualSignup} className="mt-6 space-y-4">
          <p className="text-[12px] text-ink-muted">
            We didn&apos;t detect a verified session from the email link. Create your account
            directly below — we&apos;ll auto-bind your role and vertical from the invite token.
          </p>

          <Input
            label="Invite token"
            value={token}
            onChange={setToken}
            placeholder="Paste from your invite email/link"
            type="text"
          />
          <Input label="Email" value={signupEmail} onChange={setSignupEmail} type="email" />
          <Input label="Full name" value={signupName} onChange={setSignupName} type="text" />
          <Input
            label="Password (min 8 chars)"
            value={signupPwd}
            onChange={setSignupPwd}
            type="password"
          />

          {error && (
            <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="text-[11.5px] font-medium text-edgreen bg-edgreen-50 border border-edgreen/20 rounded-lg px-3 py-2">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full rounded-lg bg-navy text-white font-semibold text-sm py-3 hover:bg-navy-800 transition disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account & accept invite →"}
          </button>
        </form>
      )}

      {stage !== "success" && (
        <div className="mt-5 text-center text-[12px] text-ink-subtle">
          Already have an account?{" "}
          <Link href="/login" className="text-navy font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      <span className="text-[10.5px] uppercase tracking-wider font-bold text-ink-subtle w-20">
        {label}
      </span>
      <span className="text-ink ml-1">{value}</span>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
      />
    </div>
  );
}
