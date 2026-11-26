"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CurrencySelector from "@/components/shell/currency-selector";
import UnitSelector from "@/components/shell/unit-selector";
import ThemeSwitcher from "@/components/shell/theme-switcher";
import MayaButton from "@/components/maya/maya-button";

export default function Header({
  title,
  subtitle,
  orgName,
}: {
  title: string;
  subtitle?: string;
  orgName: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <header className="fixed left-[256px] right-0 top-0 h-[66px] bg-white/95 backdrop-blur-md border-b border-[var(--border)] z-[90] flex items-center px-5 gap-3 shadow-[0_1px_10px_rgba(28,54,135,0.05)]">
      <div className="min-w-[160px] max-w-[280px] flex-shrink-0">
        <div className="font-serif text-[19px] font-bold text-navy leading-tight truncate">{title}</div>
        <div className="text-[10px] text-ink-subtle truncate">
          {subtitle || `FY 2025-26 · ${today} · ${orgName}`}
        </div>
      </div>

      <div className="flex-1" />

      <CurrencySelector />
      <UnitSelector />
      <ThemeSwitcher />
      <MayaButton />

      <button
        onClick={signOut}
        className="px-3 py-1.5 rounded-lg bg-[#ED1B2F] text-white text-[11.5px] font-semibold hover:bg-[#b8101f] transition shadow-[0_4px_14px_rgba(237,27,47,0.30)]"
      >
        Sign out
      </button>
    </header>
  );
}
