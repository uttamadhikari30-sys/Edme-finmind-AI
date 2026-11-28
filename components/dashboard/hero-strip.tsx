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
      {/* fine dot grid + top sheen */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative z-10 px-8 py-7 flex items-center gap-8 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/75 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
              LIVE
            </span>
            <span className="text-[11px] uppercase tracking-[2px] text-white/45 font-bold">
              FINMIND AI · {periodLabel}
            </span>
          </div>
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.05] tracking-[-0.01em]">
            {greet()}, <span style={{ color: "#FFD580" }}>{userName.split(" ")[0]}</span>
          </h1>
          <div className="mt-3 h-[3px] w-20 rounded-full" style={{ background: "linear-gradient(90deg,#ED1B2F,#C8952A)" }} />
          <p className="mt-3.5 text-[13px] text-white/65 max-w-md leading-relaxed">
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
    <div className="relative bg-white/[0.07] backdrop-blur rounded-xl pl-5 pr-5 py-3.5 border border-white/10 min-w-[144px] overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: accent, opacity: 0.85 }} />
      <div className="text-[10px] uppercase tracking-[1.5px] font-bold text-white/55">{label}</div>
      <div
        className="mt-1.5 font-mono text-[23px] font-bold leading-none"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}
