"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForcePasswordChangeForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 10) {
      // soft warning; allow but suggest stronger
    }

    setLoading(true);
    // Update password AND clear the must_change_password flag
    const { error: pwdErr } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false, password_changed_at: new Date().toISOString() },
    });
    setLoading(false);

    if (pwdErr) {
      setError(pwdErr.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-[var(--border)] p-9 animate-fade-up">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/edme-logo.png"
            alt="Edme"
            style={{ height: "30px", width: "auto", margin: "0 auto" }}
          />
          <h1 className="mt-4 font-serif text-[24px] font-bold text-navy">Set your password</h1>
          <p className="text-[13px] text-ink-muted mt-1">
            First-time login. Choose a new password to continue.
          </p>
          <div className="mt-3 rounded-lg bg-edgreen-50 border border-edgreen/30 px-3 py-2 text-[11.5px] text-edgreen font-semibold">
            ✓ Signed in as {userEmail}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                autoFocus
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
            <div className="mt-1 text-[10.5px] text-ink-subtle">
              Use 8+ characters with a mix of letters, numbers and a symbol.
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
            disabled={loading}
            className="w-full rounded-lg text-white font-semibold text-sm py-3 transition disabled:opacity-60 hover:brightness-110 shadow-[0_8px_24px_rgba(237,27,47,0.35)]"
            style={{ background: "linear-gradient(135deg,#ED1B2F 0%,#b8101f 100%)" }}
          >
            {loading ? "Saving…" : "Set password & continue →"}
          </button>
        </form>

        <div className="mt-5 text-[10.5px] text-ink-subtle text-center">
          Welcome to <span className="font-semibold text-navy">FINMIND AI</span> · Edme Insurance Brokers Limited
        </div>
      </div>
    </div>
  );
}
