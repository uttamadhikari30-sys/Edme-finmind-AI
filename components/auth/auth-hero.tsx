"use client";

// A unique, on-brand signature for the login panel: the "FINMIND Flow" —
// the AOP-to-boardroom journey as an animated vertical stepper with glowing
// nodes and a self-drawing connector. Pure SVG + CSS, no dependencies.
const STEPS = [
  { t: "Plan", d: "Build next year's AOP — client by client, product by product." },
  { t: "Freeze", d: "CFO locks the plan; mid & back-office overhead allocates." },
  { t: "Auto-Financials", d: "P&L, Balance Sheet & Cash Flow generate themselves." },
  { t: "Board-Ready", d: "One click to a board-approval deck and live MIS." },
];

export default function AuthHero() {
  return (
    <div className="auth-hero relative mt-10 max-w-md">
      <style>{`
        @keyframes ahf-line { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes ahf-rise { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ahf-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(237,27,47,0.45); } 50% { box-shadow: 0 0 0 6px rgba(237,27,47,0); } }
        .ahf-rail { transform-origin: top; animation: ahf-line 1.4s ease-out .2s both; }
        .ahf-step { animation: ahf-rise .6s ease-out both; }
        .ahf-node { animation: ahf-glow 2.4s ease-in-out infinite; }
      `}</style>

      <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 mb-5 text-[10.5px] font-bold tracking-[1.5px] uppercase text-white/70 backdrop-blur-sm">
        The FINMIND Flow
      </div>

      <div className="relative pl-7">
        {/* vertical rail */}
        <div
          className="ahf-rail absolute left-[10px] top-2 bottom-3 w-[2px] rounded-full"
          style={{ background: "linear-gradient(180deg,#C8952A,#ED1B2F 70%,transparent)" }}
        />
        <div className="space-y-5">
          {STEPS.map((s, i) => (
            <div key={s.t} className="ahf-step relative" style={{ animationDelay: `${0.35 + i * 0.22}s` }}>
              {/* node */}
              <span
                className={`absolute -left-7 top-1 w-[21px] h-[21px] rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === STEPS.length - 1 ? "ahf-node" : ""}`}
                style={{ background: i === STEPS.length - 1 ? "#ED1B2F" : "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.25)" }}
              >
                {i + 1}
              </span>
              <div className="text-[14.5px] font-semibold text-white leading-tight">{s.t}</div>
              <div className="text-[12.5px] text-white/60 leading-snug mt-0.5">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7 flex items-center gap-2.5 text-[11.5px] text-white/55">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
        16 verticals · live MIS · AI on every module
      </div>
    </div>
  );
}
