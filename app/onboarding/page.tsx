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

    // Create org
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name, slug, fiscal_year_start_month: 4, currency: "INR" })
      .select()
      .single();
    if (orgErr || !org) {
      setError(orgErr?.message ?? "Could not create organization");
      setLoading(false);
      return;
    }

    // Add membership as owner
    const { error: memErr } = await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });
    if (memErr) {
      setError(memErr.message);
      setLoading(false);
      return;
    }

    // Seed: 12 fiscal periods + a starter Chart of Accounts
    const fyStart = new Date(new Date().getFullYear(), 3, 1); // April 1
    const periods = Array.from({ length: 12 }).map((_, i) => {
      const start = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const label = start.toLocaleString("en-IN", { month: "short", year: "numeric" });
      return {
        org_id: org.id,
        period_label: label,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: "open" as const,
      };
    });
    await supabase.from("fiscal_periods").insert(periods);

    const accounts = [
      { code: "1000", name: "Bank — HDFC Current", type: "asset" },
      { code: "1100", name: "Trade Receivables", type: "asset" },
      { code: "1200", name: "Prepaid Expenses", type: "asset" },
      { code: "1500", name: "Office Equipment", type: "asset" },
      { code: "2000", name: "Trade Payables", type: "liability" },
      { code: "2100", name: "Accrued Expenses", type: "liability" },
      { code: "2200", name: "GST Payable", type: "liability" },
      { code: "3000", name: "Share Capital", type: "equity" },
      { code: "3100", name: "Retained Earnings", type: "equity" },
      { code: "4000", name: "Brokerage Income", type: "revenue" },
      { code: "4100", name: "Trail Commission", type: "revenue" },
      { code: "4200", name: "Advisory Fees", type: "revenue" },
      { code: "5000", name: "Salaries & Wages", type: "expense" },
      { code: "5100", name: "Office Rent", type: "expense" },
      { code: "5200", name: "Marketing", type: "expense" },
      { code: "5300", name: "Technology", type: "expense" },
      { code: "5400", name: "Travel", type: "expense" },
      { code: "5500", name: "Professional Fees", type: "expense" },
    ].map((a) => ({
      org_id: org.id,
      account_code: a.code,
      account_name: a.name,
      account_type: a.type as "asset" | "liability" | "equity" | "revenue" | "expense",
      is_active: true,
    }));
    await supabase.from("chart_of_accounts").insert(accounts);

    const verticals = [
      { code: "CORP", name: "Corporate" },
      { code: "SME", name: "SME & MSME" },
      { code: "HEALTH", name: "Health" },
      { code: "RETAIL", name: "Retail / HNW" },
      { code: "MOTOR", name: "Motor" },
    ].map((v) => ({ org_id: org.id, code: v.code, name: v.name }));
    await supabase.from("business_units").insert(verticals);

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-card border border-[var(--border)] p-8">
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
