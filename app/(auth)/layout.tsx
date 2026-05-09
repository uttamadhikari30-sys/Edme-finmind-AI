export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden text-white"
           style={{ background: "linear-gradient(135deg,#050d24 0%,#0c1e50 55%,#1C3687 100%)" }}>
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: "radial-gradient(circle at 80% 0%, rgba(237,27,47,0.45), transparent 35%), radial-gradient(circle at 0% 100%, rgba(200,149,42,0.35), transparent 40%)" }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="text-3xl font-serif font-bold tracking-tight">
              FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
            </div>
            <div className="text-[10px] tracking-[2px] uppercase text-white/40 mt-1">
              Edme MIS Platform
            </div>
          </div>
          <div>
            <div className="text-2xl font-serif leading-tight max-w-md">
              Financial intelligence, in one place.
            </div>
            <p className="mt-3 text-sm text-white/60 max-w-md">
              Real-time P&amp;L, variance analysis, vertical performance, AOP planning and
              board-ready insights — built for Edme Insurance Brokers Limited.
            </p>
            <div className="mt-8 text-xs text-white/40">
              🔐 256-bit SSL · Strictly Confidential
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
