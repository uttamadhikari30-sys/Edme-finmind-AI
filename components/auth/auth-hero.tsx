"use client";

// Unique, on-brand signature for the login panel: the FINMIND rhythm — a
// MONTHLY MIS loop with the ANNUAL AOP as its yearly anchor. Each step is
// tagged with its cadence. Pure SVG + CSS, no dependencies.
const STEPS = [
  { t: "MIS", tag: "Monthly", d: "Monthly MIS closure — ledger, payroll & debtors, reconciled." },
  { t: "Forecast", tag: "Monthly", d: "Latest Estimate refreshes the full-year outlook." },
  { t: "Insight", tag: "Monthly", d: "Live P&L, variance, MoM & cash flow — AI on every module." },
  { t: "Annual AOP", tag: "Yearly", d: "Build & freeze the AOP — board-ready in a click." },
];

export default function AuthHero() {
  return (
    <div className="auth-hero relative mt-6 max-w-md">
      <style>{`
        @keyframes ahf-line { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes ahf-rise { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ahf-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(237,27,47,0.45); } 50% { box-shadow: 0 0 0 6px rgba(237,27,47,0); } }
        .ahf-rail { transform-origin: top; animation: ahf-line 1.4s ease-out .2s both; }
        .ahf-step { animation: ahf-rise .6s ease-out both; }
        .ahf-node { animation: ahf-glow 2.4s ease-in-out infinite; }
      `}</style>

      <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 mb-3.5 text-[10px] font-bold tracking-[1.5px] uppercase text-white/70 backdrop-blur-sm">
        The FINMIND Rhythm · Monthly MIS · Annual AOP
      </div>

      <div className="relative pl-7">
        {/* vertical rail */}
        <div
          className="ahf-rail absolute left-[10px] top-2 bottom-3 w-[2px] rounded-full"
          style={{ background: "linear-gradient(180deg,#C8952A,#ED1B2F 70%,transparent)" }}
        />
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="ahf-step relative" style={{ animationDelay: `${0.3 + i * 0.2}s` }}>
              {/* node */}
              <span
                className={`absolute -left-7 top-[3px] w-[20px] h-[20px] rounded-full flex items-center justify-center text-[9.5px] font-bold text-white ${s.tag === "Yearly" ? "ahf-node" : ""}`}
                style={{ background: s.tag === "Yearly" ? "#ED1B2F" : "rgba(255,255,255,0.10)", border: "1.5px solid rgba(255,255,255,0.25)" }}
              >
                {i + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-white leading-tight">{s.t}</span>
                <span
                  className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    color: s.tag === "Yearly" ? "#ffd580" : "#8fe9d0",
                    background: s.tag === "Yearly" ? "rgba(255,213,128,0.12)" : "rgba(0,212,168,0.12)",
                  }}
                >
                  {s.tag}
                </span>
              </div>
              <div className="text-[12px] text-white/60 leading-snug mt-0.5">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5 text-[11px] text-white/55">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
        16 verticals · live MIS · AI on every module
      </div>
    </div>
  );
}
