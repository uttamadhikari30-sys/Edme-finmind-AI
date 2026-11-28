"use client";

import { useSearchParams } from "next/navigation";

// Switchable login backdrop so variants can be compared via ?bg=navy|purple|white.
// Default is navy. The centered login card renders above this (z-10).
export default function AuthBackground() {
  const bg = (useSearchParams().get("bg") || "navy").toLowerCase();

  if (bg === "white") {
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(160deg,#f6f8fc 0%,#eef1f8 55%,#e7ebf6 100%)" }}>
        {/* soft brand tints */}
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(40% 40% at 85% 8%, rgba(237,27,47,0.06), transparent 70%), radial-gradient(42% 42% at 8% 92%, rgba(28,54,135,0.07), transparent 70%)" }} />
        {/* large floating Edme logo watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/edme-logo.png"
          alt=""
          aria-hidden
          className="absolute auth-float"
          style={{ width: "560px", maxWidth: "48vw", top: "16%", left: "6%", opacity: 0.06, filter: "grayscale(1)" }}
        />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(28,54,135,0.10) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5 }} />
      </div>
    );
  }

  if (bg === "purple") {
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(140deg,#190721 0%,#3a1030 48%,#5e1d44 100%)" }}>
        <div className="absolute inset-0 auth-aurora" style={{ backgroundImage: "radial-gradient(40% 40% at 82% 8%, rgba(237,27,47,0.42), transparent 70%), radial-gradient(44% 44% at 6% 94%, rgba(200,149,42,0.30), transparent 70%), radial-gradient(44% 44% at 96% 96%, rgba(190,70,160,0.40), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "26px 26px", opacity: 0.10 }} />
      </div>
    );
  }

  // navy (default)
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg,#050d24 0%,#0b1a45 48%,#1C3687 100%)" }}>
      <div className="absolute inset-0 auth-aurora" style={{ backgroundImage: "radial-gradient(38% 38% at 80% 8%, rgba(237,27,47,0.42), transparent 70%), radial-gradient(42% 42% at 8% 92%, rgba(200,149,42,0.32), transparent 70%), radial-gradient(40% 40% at 95% 95%, rgba(124,58,237,0.30), transparent 70%)" }} />
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "26px 26px", opacity: 0.10 }} />
    </div>
  );
}
