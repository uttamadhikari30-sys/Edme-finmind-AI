import AuthHero from "@/components/auth/auth-hero";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#050d24 0%,#0b1a45 48%,#1C3687 100%)" }}
    >
      {/* full-screen aurora + dot grid */}
      <div
        className="absolute inset-0 pointer-events-none auth-aurora"
        style={{
          backgroundImage:
            "radial-gradient(38% 38% at 80% 8%, rgba(237,27,47,0.42), transparent 70%), radial-gradient(42% 42% at 8% 92%, rgba(200,149,42,0.32), transparent 70%), radial-gradient(40% 40% at 95% 95%, rgba(124,58,237,0.30), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
      />

      {/* ── Centered login card ─────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-[1040px] rounded-[26px] overflow-hidden flex flex-col lg:flex-row bg-white"
        style={{ boxShadow: "0 44px 110px -24px rgba(5,13,36,0.70)" }}
      >
        {/* Left brand side */}
        <div
          className="lg:w-[46%] relative text-white px-9 py-9 lg:py-10 flex flex-col justify-center overflow-hidden"
          style={{ background: "linear-gradient(150deg,#050d24 0%,#0b1a45 55%,#1C3687 100%)" }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="relative z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/edme-logo.png"
              alt="Edme Insurance Brokers"
              style={{ height: "32px", width: "auto", maxWidth: "180px", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
            <div className="mt-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-wide text-white/80 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
                Enterprise Finance Intelligence
              </div>
              <div className="mt-4 font-serif text-[40px] font-bold leading-[0.95] tracking-tight">
                FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
              </div>
              <div className="mt-2.5 h-[3px] w-20 rounded-full" style={{ background: "linear-gradient(90deg,#ED1B2F,#C8952A)" }} />
              <p className="mt-3 text-[12.5px] text-white/70 leading-relaxed">
                Edme&apos;s monthly MIS and annual AOP in one platform — live P&amp;L, variance,
                forecasting and board-ready plans.
              </p>
            </div>

            <AuthHero />

            <div className="mt-6 pt-4 border-t border-white/10 text-[11px]">
              <span className="font-bold text-white">Edme Insurance Brokers Limited</span>
              <span className="text-white/40"> · © Edme 2026 · Mumbai, India</span>
            </div>
          </div>
        </div>

        {/* Right form side */}
        <div className="lg:w-[54%] bg-white flex items-center justify-center px-6 py-9 sm:px-10 lg:px-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
