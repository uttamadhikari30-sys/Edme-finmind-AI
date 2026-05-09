"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

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
        <h1 className="mt-4 font-serif text-[24px] font-bold text-navy">Reset password</h1>
        <p className="text-[13px] text-ink-muted mt-1">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {!done ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
              placeholder="you@edmebrokers.com"
            />
          </div>

          {error && (
            <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-navy text-white font-semibold text-sm py-3 hover:bg-navy-800 transition disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link →"}
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-xl bg-edgreen-50 border border-edgreen/30 px-4 py-5 text-center">
          <div className="text-2xl mb-2">📬</div>
          <div className="text-[13px] font-bold text-edgreen">Check your inbox</div>
          <div className="text-[12px] text-ink-muted mt-1">
            We sent a reset link to <span className="font-semibold">{email}</span>. Click it to set a new password.
          </div>
        </div>
      )}

      <div className="mt-5 text-center text-[12px] text-ink-subtle">
        <Link href="/login" className="text-navy font-semibold hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
