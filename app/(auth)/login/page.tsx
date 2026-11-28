"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [ssoLoading, setSsoLoading] = useState(false);
  async function signInWithMicrosoft() {
    setError(null);
    setSsoLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid profile email",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setSsoLoading(false);
      setError(
        error.message?.includes("provider is not enabled")
          ? "Microsoft 365 sign-in isn't enabled yet. Ask your admin to turn on the Azure provider in Supabase."
          : error.message
      );
    }
    // On success the browser is redirected to Microsoft, so no further action here.
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) return setError(error.message);
      setInfo(`One-time login link sent to ${email}. Check your inbox.`);
    }
  }

  return (
    <div className="w-full">
      <div>
        {/* Mobile-only brand (left panel is hidden on small screens) */}
        <div className="lg:hidden text-center mb-6">
          <div className="font-serif text-[34px] font-bold leading-none text-navy">
            FINMIND <span className="text-edred">AI</span>
          </div>
        </div>

        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/edme-logo.png"
            alt="Edme"
            style={{ height: "30px", width: "auto" }}
            className="mx-auto"
          />
          <h1 className="mt-5 font-serif text-[27px] font-bold text-navy leading-tight">
            Welcome back
          </h1>
          <p className="text-[12.5px] text-ink-muted mt-1.5">
            Sign in to your <span className="font-semibold text-ink">FINMIND AI</span> workspace
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          {/* Email */}
          <Field label="Work email">
            <div className="relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle group-focus-within:text-navy transition">
                <MailIcon />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-11 pr-3 py-3 text-sm text-ink focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10 outline-none transition"
                placeholder="you@edmeinsurance.com"
              />
            </div>
          </Field>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            {(["password", "otp"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-semibold transition ${
                  mode === m
                    ? "bg-white text-navy shadow-[0_2px_8px_rgba(28,54,135,0.10)]"
                    : "text-ink-subtle hover:text-navy"
                }`}
              >
                {m === "password" ? <LockIcon small /> : <MailIcon small />}
                {m === "password" ? "Password" : "Email link"}
              </button>
            ))}
          </div>

          {/* Password */}
          {mode === "password" && (
            <Field
              label="Password"
              right={
                <Link
                  href="/forgot-password"
                  className="text-[10.5px] text-navy hover:underline font-semibold"
                >
                  Forgot password?
                </Link>
              }
            >
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle group-focus-within:text-navy transition">
                  <LockIcon />
                </span>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-11 pr-11 py-3 text-sm text-ink focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10 outline-none transition"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-navy transition"
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
          )}

          {mode === "otp" && (
            <p className="text-[11.5px] text-ink-muted bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 leading-relaxed">
              We&apos;ll email you a secure one-time link — no password needed.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-xl px-3.5 py-2.5">
              <span className="mt-px">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 text-[11.5px] font-medium text-edgreen bg-edgreen-50 border border-edgreen/20 rounded-xl px-3.5 py-2.5">
              <span className="mt-px">✉️</span>
              <span>{info}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl text-white font-semibold text-[14px] py-3.5 transition-all disabled:opacity-60 hover:-translate-y-0.5 shadow-[0_12px_28px_-8px_rgba(237,27,47,0.55)]"
            style={{ background: "linear-gradient(135deg,#ED1B2F 0%,#b8101f 100%)" }}
          >
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              {loading
                ? mode === "password"
                  ? "Signing in…"
                  : "Sending link…"
                : (
                  <>
                    {mode === "password" ? "Sign in to FINMIND AI" : "Email me a login link"}
                    <ArrowIcon />
                  </>
                )}
            </span>
          </button>

          {/* SSO divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-[var(--border-2)]" />
            <span className="text-[10.5px] uppercase tracking-wider text-ink-subtle font-semibold">or</span>
            <div className="h-px flex-1 bg-[var(--border-2)]" />
          </div>

          {/* Microsoft 365 SSO */}
          <button
            type="button"
            onClick={signInWithMicrosoft}
            disabled={ssoLoading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[var(--border)] bg-white py-3 text-[13.5px] font-semibold text-ink hover:border-navy hover:bg-navy/[0.02] transition disabled:opacity-60"
          >
            <MicrosoftIcon />
            {ssoLoading ? "Redirecting to Microsoft…" : "Continue with Microsoft 365"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[var(--border-2)] flex items-center justify-center gap-1.5 text-[10.5px] text-ink-subtle">
          <LockIcon small />
          256-bit SSL · Edme Insurance Brokers Limited · Strictly Confidential
        </div>
        <div className="mt-2 text-center text-[10.5px] text-ink-subtle">
          Developed &amp; designed by{" "}
          <span className="font-semibold text-navy">Uttam Singh Adhikari</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Inline icons (premium, theme-agnostic) ──────────────────────────── */
function MicrosoftIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
function MailIcon({ small }: { small?: boolean }) {
  const s = small ? 13 : 17;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function LockIcon({ small }: { small?: boolean }) {
  const s = small ? 13 : 17;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.43M6.6 6.6A13.2 13.2 0 0 0 2 11s3.5 7 10 7a9.1 9.1 0 0 0 4.3-1.06" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg className="transition-transform group-hover:translate-x-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
