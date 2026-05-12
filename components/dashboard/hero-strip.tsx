"use client";

import { useCurrency, formatCurrencyLakhs } from "@/lib/currency";

export default function HeroStrip({
  orgName,
  periodLabel,
  userName,
  revenueInr,
  ebitdaInr,
  marginPct,
  jeCount,
}: {
  orgName: string;
  periodLabel: string;
  userName: string;
  revenueInr: number;
  ebitdaInr: number;
  marginPct: number;
  jeCount: number;
}) {
  const currency = useCurrency();
  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-5 text-white shadow-card"
      style={{
        background:
          "linear-gradient(135deg,#050d24 0%,#0c1e50 35%,#1C3687 70%,#2a4cc0 100%)",
      }}
    >
      {/* Decorative overlays */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 90% 0%, rgba(237,27,47,0.55), transparent 35%), radial-gradient(circle at 0% 100%, rgba(200,149,42,0.4), transparent 50%), radial-gradient(circle at 50% 50%, rgba(124,58,237,0.18), transparent 50%)",
        }}
      />
      <div
        className="absolute -right-12 -top-12 w-72 h-72 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}
      />

      <div className="relative z-10 px-7 py-6 flex items-center gap-8 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="text-[11px] uppercase tracking-[2px] text-white/45 font-bold">
            FINMIND AI · {periodLabel}
          </div>
          <h1 className="mt-2 font-serif text-[28px] font-bold leading-tight">
            {greet()}, <span style={{ color: "#FFD580" }}>{userName.split(" ")[0]}</span>
          </h1>
          <p className="mt-2 text-[13px] text-white/65 max-w-md">
            Here&apos;s the snapshot for {orgName}. {jeCount} posted entries this period.
            All numbers update live with FX and ₹ View settings.
          </p>
        </div>

        <div className="flex items-stretch gap-3">
          <HeroStat
            label="Revenue"
            value={formatCurrencyLakhs(revenueInr, currency)}
            accent="#FFD580"
          />
          <HeroStat
            label="EBITDA"
            value={formatCurrencyLakhs(ebitdaInr, currency)}
            accent={ebitdaInr >= 0 ? "#00d4a8" : "#ff8b95"}
          />
          <HeroStat
            label="Margin"
            value={`${marginPct.toFixed(1)}%`}
            accent={marginPct >= 20 ? "#00d4a8" : marginPct >= 10 ? "#FFD580" : "#ff8b95"}
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white/[0.07] backdrop-blur rounded-xl px-5 py-3.5 border border-white/10 min-w-[140px]">
      <div className="text-[10px] uppercase tracking-[1.5px] font-bold text-white/55">{label}</div>
      <div
        className="mt-1.5 font-mono text-[22px] font-bold leading-none"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}
