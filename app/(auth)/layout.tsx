import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[44%] relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg,#050d24 0%,#0c1e50 55%,#1C3687 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 0%, rgba(237,27,47,0.45), transparent 35%), radial-gradient(circle at 0% 100%, rgba(200,149,42,0.35), transparent 40%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <Image
              src="/edme-logo.png"
              alt="Edme Insurance Brokers"
              width={180}
              height={56}
              priority
              className="block"
              style={{ filter: "brightness(0) invert(1)", height: "44px", width: "auto" }}
            />
            <div className="mt-8 text-3xl font-serif font-bold tracking-tight">
              FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
            </div>
            <div className="text-[10px] tracking-[2px] uppercase text-white/40 mt-1">
              Edme MIS Platform · v1.0
            </div>
          </div>
          <div>
            <div className="text-2xl font-serif leading-tight max-w-md">
              Financial intelligence, in one place.
            </div>
            <p className="mt-3 text-sm text-white/65 max-w-md leading-relaxed">
              Real-time P&amp;L, variance analysis, vertical performance, AOP planning and
              board-ready insights — built for Edme Insurance Brokers Limited.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-white/40">
              <span>🔐</span> 256-bit SSL · Strictly Confidential
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-md">
          {/* Mobile-only logo */}
          <div className="lg:hidden mb-8 text-center">
            <Image
              src="/edme-logo.png"
              alt="Edme Insurance Brokers"
              width={140}
              height={42}
              priority
              style={{ height: "36px", width: "auto" }}
              className="mx-auto"
            />
            <div className="mt-3 text-2xl font-serif font-bold text-navy">
              FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
            </div>
            <div className="text-[10px] tracking-[2px] uppercase text-ink-subtle mt-1">
              Edme MIS Platform
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
