"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Role = "cfo" | "ceo" | "bh" | "finance";
type Mode = "password" | "otp";

const ROLES: { id: Role; label: string; sub: string; icon: string }[] = [
  { id: "cfo",     label: "CFO",           sub: "Full access",     icon: "👑" },
  { id: "ceo",     label: "CEO",           sub: "Executive",       icon: "🎯" },
  { id: "bh",      label: "Business Head", sub: "My vertical",     icon: "📊" },
  { id: "finance", label: "Finance",       sub: "MIS & Reports",   icon: "📋" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState<Role>("cfo");
  const [mode, setMode] = useState<Mode>("password");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      // OTP / magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) return setError(error.message);
      setInfo(`Magic link sent to ${email}. Check your inbox and click the link to sign in.`);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-[var(--border)] p-8 lg:p-9 animate-fade-up">
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
        <h1 className="mt-4 font-serif text-[26px] font-bold text-navy leading-tight">Welcome Back</h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Edme Insurance Brokers Limited · FINMIND AI
        </p>
      </div>

      <div className="my-5 border-t border-[var(--border-2)]" />

      {/* Role selector */}
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-[1.5px] text-ink-subtle mb-2.5">
          Select your role
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ROLES.map((r) => {
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={[
                  "rounded-xl border-2 px-2 py-3 text-center transition cursor-pointer",
                  active
                    ? "border-navy bg-navy-50/40 shadow-soft"
                    : "border-[var(--border)] bg-white hover:border-navy/40 hover:bg-navy-50/20",
                ].join(" ")}
              >
                <div className="text-[20px] leading-none">{r.icon}</div>
                <div className={`mt-1.5 text-[12px] font-bold ${active ? "text-navy" : "text-ink"}`}>
                  {r.label}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{r.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Field label="Full name">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-[13px]">👤</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
              placeholder="e.g. Praveen Ladia"
            />
          </div>
        </Field>

        <Field label="Email">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-[13px]">✉️</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
              placeholder="you@edmebrokers.com"
            />
          </div>
        </Field>

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          {(["password", "otp"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-md text-[11.5px] font-semibold transition ${
                mode === m ? "bg-white text-navy shadow-soft" : "text-ink-subtle hover:text-navy"
              }`}
            >
              {m === "password" ? "🔑 Password" : "✉️ Email link (OTP)"}
            </button>
          ))}
        </div>

        {mode === "password" && (
          <Field
            label="Password"
            right={
              <Link href="/forgot-password" className="text-[10.5px] text-navy hover:underline font-semibold">
                Forgot?
              </Link>
            }
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-[13px]">🔒</span>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-10 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle text-[13px] px-1"
                tabIndex={-1}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>
        )}

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
          disabled={loading}
          className="w-full rounded-lg text-white font-semibold text-[14px] py-3 transition disabled:opacity-60 hover:brightness-110 shadow-[0_8px_24px_rgba(237,27,47,0.35)]"
          style={{ background: "linear-gradient(135deg,#ED1B2F 0%,#b8101f 100%)" }}
        >
          {loading
            ? mode === "password" ? "Signing in…" : "Sending link…"
            : <>Sign in to FINMIND AI <span className="ml-1">→</span></>
          }
        </button>
      </form>

      <div className="mt-5 text-center text-[11px] text-ink-subtle">
        🔐 256-bit SSL · Edme Insurance Brokers Limited · Strictly Confidential
      </div>

      <div className="mt-4 text-[11px] text-ink-subtle text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-navy font-semibold hover:underline">
          Create one
        </Link>{" "}
        · Got an invite?{" "}
        <Link href="/accept-invite" className="text-navy font-semibold hover:underline">
          Accept here
        </Link>
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
        <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
        {right}
      </div>
      {children}
    </div>
  );
}
