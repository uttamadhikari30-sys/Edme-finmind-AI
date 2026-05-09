"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PostButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_post_journal_entry", { p_je_id: id });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[11px] text-edred">{err}</span>}
      <button
        onClick={post}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-800 disabled:opacity-60"
      >
        {busy ? "Posting…" : "Post →"}
      </button>
    </div>
  );
}
