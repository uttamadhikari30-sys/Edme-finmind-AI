"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInviteClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();
  const tokenFromUrl = sp.get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function tryAcceptDirectly(theToken: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.rpc("fn_accept_invite", { p_token: theToken });
    if (error) {
      setError(error.message);
      return true;
    }
    router.push("/dashboard");
    router.refresh();
    return true;
  }

  useEffect(() => {
    if (tokenFromUrl) tryAcceptDirectly(tokenFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl]);

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
        emailRedirectTo: `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`,
      },
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
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
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setInfo(
      `Check your inbox at ${email}. Click the confirmation link, then come back and re-open this invite link to finish.`
    );
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
        <h1 className="mt-4 font-serif text-[24px] font-bold text-navy">Accept your invite</h1>
        <p className="text-[13px] text-ink-muted mt-1">Set up your FINMIND AI account.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input label="Invite token" value={token} onChange={setToken} placeholder="Paste from your invite email/link" />
        <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="you@edmebrokers.com" />
        <Input label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Praveen Ladia" />
        <Input label="Password (min 8 chars)" value={password} onChange={setPassword} type="password" />

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
          {loading ? "Accepting…" : "Accept invite & continue →"}
        </button>
      </form>

      <div className="mt-5 text-center text-[12px] text-ink-subtle">
        Already have an account?{" "}
        <Link href="/login" className="text-navy font-semibold hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
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
