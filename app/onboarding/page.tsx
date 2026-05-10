"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("Edme Insurance Brokers Limited");
  const [slug, setSlug] = useState("edme");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;

    // One atomic SECURITY DEFINER RPC creates org + adds membership +
    // seeds fiscal periods + chart of accounts + verticals — bypasses
    // any RLS sync issues from running multiple inserts back-to-back.
    const { error: rpcErr } = await supabase.rpc("fn_create_workspace", {
      p_name: name,
      p_slug: slug,
      p_full_name: fullName,
    });

    if (rpcErr) {
      setLoading(false);
      setError(rpcErr.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-card border border-[var(--border)] p-8 mt-12">
      <h1 className="font-serif text-2xl font-bold text-navy">Welcome to FINMIND AI</h1>
      <p className="text-sm text-ink-muted mt-1">
        Set up your organization to get started. We&apos;ll seed your fiscal periods, chart of
        accounts, and verticals so you can post entries right away.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">
            Organization name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">URL slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            required
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:border-navy focus:bg-white outline-none"
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
          className="w-full rounded-lg bg-navy text-white font-semibold text-sm py-3 hover:bg-navy-800 transition disabled:opacity-60"
        >
          {loading ? "Setting things up…" : "Create my workspace →"}
        </button>
      </form>
    </div>
  );
}
