import AuthHero from "@/components/auth/auth-hero";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-stretch bg-[var(--bg)]">
      {/* ── Left brand panel ───────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] relative overflow-hidden text-white"
        style={{ background: "linear-gradient(135deg,#050d24 0%,#0b1a45 50%,#1C3687 100%)" }}
      >
        {/* animated aurora */}
        <div
          className="absolute inset-0 pointer-events-none auth-aurora"
          style={{
            backgroundImage:
              "radial-gradient(42% 42% at 78% 6%, rgba(237,27,47,0.45), transparent 70%), radial-gradient(46% 46% at 6% 94%, rgba(200,149,42,0.38), transparent 70%), radial-gradient(44% 44% at 96% 96%, rgba(124,58,237,0.34), transparent 70%)",
          }}
        />
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.16]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* top hairline sheen */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between px-14 py-12 w-full">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/edme-logo.png"
              alt="Edme Insurance Brokers"
              style={{
                height: "42px",
                width: "auto",
                maxWidth: "200px",
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
            />

            <div className="mt-14">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/80 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
                Enterprise Finance Intelligence
              </div>

              <div className="mt-6 font-serif text-[66px] font-bold leading-[0.95] tracking-tight">
                FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
              </div>
              <div
                className="mt-4 h-[3px] w-28 rounded-full"
                style={{ background: "linear-gradient(90deg,#ED1B2F,#C8952A)" }}
              />
              <p className="mt-5 text-[15px] text-white/70 max-w-md leading-relaxed">
                From the first premium booked to the board&apos;s sign-off — one platform runs
                Edme&apos;s entire annual plan, live.
              </p>
            </div>

            {/* the FINMIND flow — unique journey stepper */}
            <AuthHero />
          </div>

          {/* bottom: company */}
          <div className="max-w-md">
            <div className="text-[13px] font-bold text-white">Edme Insurance Brokers Limited</div>
            <div className="mt-2.5 flex items-start gap-2 text-[12px] text-white/55 leading-relaxed">
              <span className="mt-0.5">📍</span>
              <span>
                VIOS Tower, 6th Floor, Off Eastern Express Highway, Sewri – Chembur Rd, Mumbai
                400037, Maharashtra, India
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <a
                href="https://www.edmeinsurance.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/80 hover:text-white underline-offset-2 hover:underline transition"
              >
                www.edmeinsurance.com
              </a>
              <span className="text-[11px] text-white/40">© Edme 2026 · All rights reserved</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 100% 0%, rgba(28,54,135,0.06), transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(237,27,47,0.05), transparent 70%)",
          }}
        />
        <div className="w-full max-w-[460px] relative z-10">{children}</div>
      </div>
    </div>
  );
}
