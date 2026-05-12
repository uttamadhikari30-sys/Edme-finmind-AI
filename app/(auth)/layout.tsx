export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[44%] relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg,#050d24 0%,#0c1e50 55%,#1C3687 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 0%, rgba(237,27,47,0.55), transparent 35%), radial-gradient(circle at 0% 100%, rgba(200,149,42,0.4), transparent 40%), radial-gradient(circle at 100% 100%, rgba(124,58,237,0.35), transparent 45%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-14 py-12 w-full">
          {/* Plain img tag — preserves aspect ratio (2500:600 ≈ 4.17:1) exactly */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/edme-logo.png"
            alt="Edme Insurance Brokers"
            style={{
              height: "44px",
              width: "auto",
              maxWidth: "200px",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
            }}
          />

          <div className="mt-12">
            <div className="font-serif text-[64px] font-bold leading-[1] tracking-tight">
              FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
            </div>
            <p className="mt-4 text-[15px] text-white/65 max-w-md">
              Intelligent MIS &amp; Finance Intelligence Platform
            </p>
          </div>

          <div className="mt-12 max-w-md">
            <div className="text-[14px] font-bold text-white">Edme Insurance Brokers Limited</div>
            <p className="mt-3 text-[13px] text-white/55 leading-relaxed">
              Enterprise-grade financial intelligence — real-time P&amp;L, FTM &amp; YTD analytics,
              VPB calculator, and AI-powered insights across all verticals.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Pill>FY 2025-26</Pill>
            <Pill>v1.0</Pill>
            <Pill>15 Verticals</Pill>
            <Pill>Role-based Access</Pill>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 bg-[var(--bg)]">
        <div className="w-full max-w-[480px]">{children}</div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] text-white/70 border border-white/15 bg-white/[0.04] backdrop-blur">
      {children}
    </span>
  );
}
