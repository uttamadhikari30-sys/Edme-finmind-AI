"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-[var(--border)] p-8 animate-fade-up">
      <div className="lg:hidden mb-6">
        <div className="text-2xl font-serif font-bold text-navy">
          FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
        </div>
        <div className="text-[10px] tracking-[2px] uppercase text-ink-subtle mt-1">
          Edme MIS Platform
        </div>
      </div>

      <h1 className="font-serif text-2xl font-bold text-navy">Welcome back</h1>
      <p className="text-sm text-ink-muted mt-1">
        Edme Insurance Brokers Limited · FINMIND AI
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-navy focus:bg-white transition"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="text-xs font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-navy text-white font-semibold text-sm py-3 hover:bg-navy-800 transition disabled:opacity-60 shadow-soft"
        >
          {loading ? "Signing in…" : "Sign in to FINMIND AI →"}
        </button>
      </form>

      <div className="mt-6 text-xs text-ink-subtle text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-navy font-semibold hover:underline">
          Create one
        </Link>
      </div>
    </div>
  );
}
