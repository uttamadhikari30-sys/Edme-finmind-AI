"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Auto-confirmed (email verification disabled in Supabase Auth settings).
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Check your email to confirm your account, then sign in.");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-[var(--border)] p-8 animate-fade-up">
      <div className="lg:hidden mb-6">
        <div className="text-2xl font-serif font-bold text-navy">
          FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
        </div>
      </div>

      <h1 className="font-serif text-2xl font-bold text-navy">Create your account</h1>
      <p className="text-sm text-ink-muted mt-1">Start a new FINMIND AI workspace.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-navy focus:bg-white transition"
            placeholder="Praveen Ladia"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Work email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-navy focus:bg-white transition"
            placeholder="you@edmebrokers.com"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-navy focus:bg-white transition"
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <div className="text-xs font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">{error}</div>
        )}
        {info && (
          <div className="text-xs font-medium text-edgreen bg-edgreen-50 border border-edgreen/20 rounded-lg px-3 py-2">{info}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy text-white font-semibold text-sm py-3 hover:bg-navy-800 transition disabled:opacity-60 shadow-soft"
        >
          {loading ? "Creating account…" : "Create account →"}
        </button>
      </form>

      <div className="mt-6 text-xs text-ink-subtle text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-navy font-semibold hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
