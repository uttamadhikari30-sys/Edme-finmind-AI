"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FreezeControl({
  fiscalYear,
  status,
}: {
  fiscalYear: string;
  status: "draft" | "frozen" | "approved";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(action: "freeze" | "approve" | "reopen") {
    if (action === "reopen" && !confirm(`Reopen the ${fiscalYear} AOP for editing? Business Heads and Finance will be able to change numbers again.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/aop/freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, action }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg(null);
      router.refresh();
    } else {
      setMsg(`⚠ ${data.error}`);
    }
  }

  const badge =
    status === "approved"
      ? { label: "● Board Approved", cls: "bg-edgreen/10 text-edgreen border-edgreen/30" }
      : status === "frozen"
      ? { label: "● Frozen", cls: "bg-gold/10 text-gold border-gold/30" }
      : { label: "● Draft — open for entry", cls: "bg-navy/10 text-navy border-navy/30" };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className={`text-[12px] font-bold px-3 py-1.5 rounded-lg border ${badge.cls}`}>{badge.label}</span>

      {status === "draft" && (
        <button onClick={() => act("freeze")} disabled={busy}
          className="px-4 py-1.5 rounded-lg bg-gold text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-60">
          {busy ? "…" : "Freeze AOP"}
        </button>
      )}
      {status !== "approved" && (
        <button onClick={() => act("approve")} disabled={busy}
          className="px-4 py-1.5 rounded-lg bg-edgreen text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-60">
          {busy ? "…" : "Approve (Board sign-off)"}
        </button>
      )}
      {status !== "draft" && (
        <button onClick={() => act("reopen")} disabled={busy}
          className="px-4 py-1.5 rounded-lg border border-edred/40 text-edred text-[12px] font-semibold hover:bg-edred-50 disabled:opacity-60">
          {busy ? "…" : "Reopen for editing"}
        </button>
      )}

      {msg && <span className="text-[12px] font-semibold text-edred">{msg}</span>}
    </div>
  );
}
