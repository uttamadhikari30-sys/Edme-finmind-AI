"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "original", label: "Edme (Original)", swatch: "#1C3687" },
  { id: "emerald", label: "Emerald", swatch: "#047857" },
  { id: "purple", label: "Royal Purple", swatch: "#6d28d9" },
  { id: "slate", label: "Slate", swatch: "#334155" },
  { id: "teal", label: "Ocean Teal", swatch: "#0f766e" },
  { id: "crimson", label: "Crimson", swatch: "#9f1239" },
];

function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  if (id === "original") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", id);
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState("original");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved =
      (typeof localStorage !== "undefined" && localStorage.getItem("fm-theme")) || "original";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function choose(id: string) {
    setTheme(id);
    try {
      localStorage.setItem("fm-theme", id);
    } catch {}
    applyTheme(id);
    setOpen(false);
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change theme"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-bg-alt text-ink-muted text-[11.5px] font-semibold hover:border-navy hover:text-navy transition"
      >
        <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: current.swatch }} />
        Theme
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 rounded-lg border border-[var(--border)] bg-white shadow-card z-[96] py-1">
            <div className="px-3 py-1.5 text-[9.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">
              Theme
            </div>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] hover:bg-bg-alt transition ${
                  t.id === theme ? "text-navy font-bold" : "text-ink-muted"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                  style={{ background: t.swatch }}
                />
                {t.label}
                {t.id === theme && <span className="ml-auto text-navy">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
