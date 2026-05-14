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
        <div className="relative z-10 flex flex-col justify-between px-14 py-12 w-full">
          {/* Top: logo + title */}
          <div>
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

            <div className="mt-14">
              <div className="font-serif text-[64px] font-bold leading-[1] tracking-tight">
                FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
              </div>
              <p className="mt-4 text-[15px] text-white/65 max-w-md">
                Intelligent MIS &amp; Finance Intelligence Platform
              </p>
            </div>
          </div>

          {/* Middle: company name + address + website */}
          <div className="max-w-md">
            <div className="text-[14px] font-bold text-white">Edme Insurance Brokers Limited</div>

            <div className="mt-4 flex items-start gap-2 text-[12px] text-white/65 leading-relaxed">
              <span className="text-[14px] mt-0.5">📍</span>
              <span>
                VIOS Tower, 6th Floor, Off Eastern Express Highway, Sewri – Chembur Rd, Mumbai
                400037, Maharashtra, India
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[12px] text-white/65">
              <span className="text-[14px]">🌐</span>
              <a
                href="https://www.edmeinsurance.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-edred-50 transition underline-offset-2 hover:underline"
              >
                www.edmeinsurance.com
              </a>
            </div>
          </div>

          {/* Bottom: copyright */}
          <div className="text-[11px] text-white/45">
            © Edme 2026 · All rights reserved
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
