"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Unit = "actual" | "lakhs" | "crores" | "millions";

const UNITS: { id: Unit; label: string }[] = [
  { id: "actual",   label: "Actual" },
  { id: "lakhs",    label: "Lakhs" },
  { id: "crores",   label: "Crores" },
  { id: "millions", label: "Millions" },
];

export default function UnitSelector() {
  const [unit, setUnit] = useState<Unit>("lakhs");

  useEffect(() => {
    const stored = (localStorage.getItem("fm_unit") ?? "lakhs") as Unit;
    setUnit(stored);
  }, []);

  function pick(u: Unit) {
    setUnit(u);
    if (typeof window !== "undefined") {
      localStorage.setItem("fm_unit", u);
      window.dispatchEvent(new CustomEvent("fm-unit-change", { detail: u }));
    }
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      <span className="text-[10.5px] uppercase tracking-[1.5px] font-bold text-ink-subtle">₹ View</span>
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-alt border border-[var(--border)]">
        {UNITS.map((u) => (
          <button
            key={u.id}
            onClick={() => pick(u.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold transition",
              unit === u.id ? "bg-navy text-white shadow-soft" : "text-ink-muted hover:text-navy"
            )}
          >
            {u.label}
          </button>
        ))}
      </div>
    </div>
  );
}
