"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    <div className="bg-white rounded-2xl shadow-card border border-[var(--border)] p-8 lg:p-9 animate-fade-up">
      <div className="text-center">
        <Image
          src="/edme-logo.png"
          alt="Edme"
          width={140}
          height={36}
          priority
          style={{ height: "32px", width: "auto" }}
          className="mx-auto"
        />
        <h1 className="mt-5 font-serif text-[26px] font-bold text-navy leading-tight">Welcome Back</h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Edme Insurance Brokers Limited · FINMIND AI
        </p>
      </div>

      <div className="my-6 border-t border-[var(--border-2)]" />

      <form onSubmit={onSubmit} className="space-y-4">
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
              placeholder="you@edmeinsurance.com"
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
                Forgot Password
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
            : <>Sign in to FINMIND AI <span className="ml-1">→</span></>}
        </button>
      </form>

      <div className="mt-5 text-center text-[11px] text-ink-subtle">
        🔐 256-bit SSL · Edme Insurance Brokers Limited · Strictly Confidential
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
