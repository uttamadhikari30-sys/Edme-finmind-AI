"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
    router.refresh();
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
        <h1 className="mt-4 font-serif text-[24px] font-bold text-navy">Set a new password</h1>
        <p className="text-[13px] text-ink-muted mt-1">Choose something strong — at least 8 characters.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input label="New password" value={password} onChange={setPassword} type="password" />
        <Input label="Confirm password" value={confirm} onChange={setConfirm} type="password" />

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
          {loading ? "Saving…" : "Update password →"}
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
      />
    </div>
  );
}
