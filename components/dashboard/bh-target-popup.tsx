"use client";

import { useEffect, useState } from "react";

type Row = {
  bu_id: string;
  actual_revenue: number | string;
  aop_revenue: number | string;
  actual_expense: number | string;
  aop_expense: number | string;
  actual_profit: number | string;
  aop_profit: number | string;
  rev_attainment_pct: number | string;
};

const L = (v: number | string) => `₹${(Number(v) / 1e5).toFixed(2)} L`;

export default function BhTargetPopup({
  row,
  name,
  period,
}: {
  row: Row | null;
  name: string;
  period: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!row) return;
    const key = `fm-bh-popup-${row.bu_id}-${period}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    setOpen(true);
  }, [row, period]);

  if (!row || !open) return null;

  const pct = Number(row.rev_attainment_pct);
  const ahead = pct >= 100;
  const gap = Number(row.aop_revenue) - Number(row.actual_revenue);
  const profitGap = Number(row.aop_profit) - Number(row.actual_profit);

  const Stat = ({ label, actual, aop }: { label: string; actual: number | string; aop: number | string }) => {
    const a = Number(actual);
    const b = Number(aop);
    const ok = a >= b;
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className="font-mono text-[18px] font-bold text-ink mt-0.5">{L(actual)}</div>
        <div className={`text-[11px] font-semibold mt-0.5 ${ok ? "text-edgreen" : "text-edred"}`}>
          {ok ? "▲" : "▼"} AOP {L(aop)}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-deep border border-[var(--border)] overflow-hidden animate-fade-up"
      >
        <div
          className="px-6 py-5 text-white relative"
          style={{ background: ahead
            ? "linear-gradient(135deg,#047857 0%,#065f46 100%)"
            : "linear-gradient(135deg,#1C3687 0%,#0f1e4e 100%)" }}
        >
          <button onClick={() => setOpen(false)} className="absolute top-3 right-4 text-white/70 hover:text-white text-[18px]">✕</button>
          <div className="text-[11px] uppercase tracking-[2px] text-white/60 font-bold">Your snapshot · {period}</div>
          <div className="font-serif text-[24px] font-bold mt-1">Hi {name.split(" ")[0]} 👋</div>
          <div className="text-[13.5px] text-white/85 mt-1.5">
            {ahead ? (
              <>You're <b>{(pct - 100).toFixed(0)}% ahead</b> of your revenue target. Strong month — keep it up.</>
            ) : (
              <>You're <b>{(100 - pct).toFixed(0)}% behind</b> target — about <b>{L(gap)}</b> of revenue to close the gap.</>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-3 gap-3">
          <Stat label="Revenue" actual={row.actual_revenue} aop={row.aop_revenue} />
          <Stat label="Profit" actual={row.actual_profit} aop={row.aop_profit} />
          <Stat label="Cost" actual={row.actual_expense} aop={row.aop_expense} />
        </div>

        <div className="px-5 pb-5">
          <div className={`rounded-xl px-4 py-3 text-[12.5px] font-semibold ${
            ahead ? "bg-edgreen-50 text-edgreen border border-edgreen/20" : "bg-gold-50 text-gold border border-gold/20"
          }`}>
            {ahead
              ? "✅ VPB eligibility: on track — you're at or above 100% of AOP."
              : `🎯 VPB eligibility: ${pct.toFixed(0)}% of AOP — close ${L(gap)} revenue (${L(profitGap)} profit) to hit target.`}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg bg-navy text-white font-semibold text-[13px] py-2.5 hover:bg-navy-800"
          >
            View my dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
