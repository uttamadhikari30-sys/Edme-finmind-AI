"use client";

import { useState } from "react";
import MayaPanel from "@/components/maya/maya-panel";

export default function MayaButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-br from-navy to-navy-500 text-white text-[11.5px] font-semibold shadow-soft hover:shadow-card transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-edgreen animate-blink" />
        Ask Maya
      </button>
      <MayaPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
