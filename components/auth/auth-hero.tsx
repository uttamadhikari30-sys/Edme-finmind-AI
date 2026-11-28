"use client";

// Live, self-drawing finance motif for the login brand panel — a premium,
// unique signature element. Pure SVG + CSS, no dependencies.
export default function AuthHero() {
  // A believable monthly revenue curve (Apr → Mar), normalized to the viewBox.
  const pts = [28, 34, 31, 37, 35, 42, 39, 46, 44, 51, 55, 62];
  const W = 440, H = 150, PAD = 6;
  const max = 70, min = 20;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (pts.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const lastX = x(pts.length - 1), lastY = y(pts[pts.length - 1]);

  return (
    <div className="auth-hero relative mt-10 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 overflow-hidden max-w-md">
      <style>{`
        @keyframes ah-draw { to { stroke-dashoffset: 0; } }
        @keyframes ah-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ah-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes ah-pulse { 0%,100% { opacity: .5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.5); } }
        .ah-line { stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: ah-draw 2.2s ease-out .25s forwards; }
        .ah-area { opacity: 0; animation: ah-rise 1.2s ease-out 1.1s forwards; }
        .ah-chip { animation: ah-rise .7s ease-out both; }
        .ah-chip-float { animation: ah-float 4.5s ease-in-out infinite; }
        .ah-dot-glow { animation: ah-pulse 1.8s ease-in-out infinite; transform-origin: center; }
      `}</style>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d4a8]" style={{ animation: "blink 1.6s infinite" }} />
          <span className="text-[11px] font-semibold tracking-wide text-white/70">FY Revenue Run-rate · Live</span>
        </div>
        <span className="font-mono text-[12px] font-bold text-white">₹2,896 L</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height: 118 }}>
        <defs>
          <linearGradient id="ahFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ED1B2F" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#ED1B2F" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ahStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C8952A" />
            <stop offset="100%" stopColor="#ED1B2F" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={PAD} y1={H * g} x2={W - PAD} y2={H * g} stroke="rgba(255,255,255,0.07)" strokeDasharray="2,5" />
        ))}
        <path d={area} fill="url(#ahFill)" className="ah-area" />
        <path d={line} fill="none" stroke="url(#ahStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ah-line" />
        <circle cx={lastX} cy={lastY} r="7" fill="#ED1B2F" opacity="0.3" className="ah-dot-glow" />
        <circle cx={lastX} cy={lastY} r="3.5" fill="#fff" />
      </svg>

      {/* Floating stat chips */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { k: "EBITDA", v: "34.1%", d: "1s" },
          { k: "YoY Growth", v: "+18%", d: "1.15s" },
          { k: "Verticals", v: "16", d: "1.3s" },
        ].map((c) => (
          <div key={c.k} className="ah-chip rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2" style={{ animationDelay: c.d }}>
            <div className="text-[9px] uppercase tracking-wider text-white/45 font-bold">{c.k}</div>
            <div className="font-mono text-[14px] font-bold text-white mt-0.5">{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
