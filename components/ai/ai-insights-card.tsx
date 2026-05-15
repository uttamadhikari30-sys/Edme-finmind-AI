"use client";

import { useEffect, useState } from "react";

type Insight = {
  icon: string;
  tone: "good" | "warn" | "info" | "opportunity" | "protective" | "cash";
  title: string;
  body: string;
};

type Source = "claude" | "rule-based" | "rule-based-fallback";

export default function AIInsightsCard({
  page,
  context,
  title = "🤖 FINMIND Intelligence",
  density = "compact",
}: {
  page: string;
  context: Record<string, any>;
  title?: string;
  density?: "compact" | "wide";
}) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, context }),
      });
      const data = await res.json();
      setInsights(data.insights ?? []);
      setSource(data.source ?? "rule-based");
    } catch (e: any) {
      setErr(e?.message ?? "Could not load insights");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, JSON.stringify(context)]);

  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)] bg-gradient-to-r from-edpurple-50/60 to-white">
        <span className="font-serif text-[15.5px] font-bold text-navy flex-1">{title}</span>
        <span className="pill" style={{ background: "#7c3aed", color: "#fff" }}>AI</span>
        {source === "claude" && <span className="pill pill-green">Live · Claude</span>}
        {source && source !== "claude" && <span className="pill pill-gold">Rule-based</span>}
        <button
          onClick={load}
          title="Regenerate insights"
          className="text-[11px] text-navy font-semibold hover:underline"
          disabled={loading}
        >
          {loading ? "⏳" : "↻"}
        </button>
      </div>
      <div className="p-4">
        {loading && !insights && (
          <div className="text-[12px] text-ink-subtle italic">Analysing your numbers…</div>
        )}
        {err && (
          <div className="text-[11.5px] font-medium text-edred bg-edred-50 border border-edred/20 rounded-lg px-3 py-2">
            {err}
          </div>
        )}
        {insights && insights.length > 0 && (
          <div className={density === "wide" ? "grid grid-cols-1 md:grid-cols-2 gap-2.5" : "space-y-2.5"}>
            {insights.map((i, idx) => (
              <Pill key={idx} insight={i} />
            ))}
          </div>
        )}
        {!loading && (!insights || insights.length === 0) && (
          <div className="text-[12px] text-ink-subtle italic">No insights yet — load more data to power AI.</div>
        )}
      </div>
    </div>
  );
}

function Pill({ insight }: { insight: Insight }) {
  const toneStyles: Record<string, { bg: string; border: string; text: string }> = {
    good:         { bg: "bg-edgreen-50/50", border: "border-edgreen/25", text: "text-edgreen" },
    warn:         { bg: "bg-edred-50/50",   border: "border-edred/25",   text: "text-edred" },
    info:         { bg: "bg-navy-50/40",    border: "border-navy/15",    text: "text-navy" },
    opportunity:  { bg: "bg-gold-50/60",    border: "border-gold/25",    text: "text-gold" },
    protective:   { bg: "bg-edpurple-50/50",border: "border-edpurple/25",text: "text-edpurple" },
    cash:         { bg: "bg-edteal-50/50",  border: "border-edteal/25",  text: "text-edteal" },
  };
  const s = toneStyles[insight.tone] ?? toneStyles.info!;
  return (
    <div className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
      <div className="flex items-start gap-2">
        <span className="text-[18px] leading-none mt-0.5 flex-shrink-0">{insight.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[11.5px] font-bold uppercase tracking-wider ${s.text}`}>
            {insight.title}
          </div>
          <div className="text-[12px] text-ink-muted mt-1 leading-relaxed">{insight.body}</div>
        </div>
      </div>
    </div>
  );
}
