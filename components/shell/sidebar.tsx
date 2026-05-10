"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { id: string; label: string; href: string; icon: string; section: string };

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "⬛", section: "OVERVIEW" },
  { id: "pl", label: "P&L Statement", href: "/pl", icon: "📋", section: "REPORTS" },
  { id: "mom", label: "Month-on-Month P&L", href: "/mom", icon: "📅", section: "REPORTS" },
  { id: "cash-flow", label: "Cash Flow", href: "/cash-flow", icon: "💵", section: "REPORTS" },
  { id: "variance", label: "Variance Analysis", href: "/variance", icon: "📈", section: "ANALYTICS" },
  { id: "vertical", label: "Vertical Performance", href: "/vertical", icon: "👥", section: "ANALYTICS" },
  { id: "vpb", label: "Variable Pay (VPB)", href: "/vpb", icon: "💜", section: "ANALYTICS" },
  { id: "le-forecast", label: "LE & Forecast", href: "/le-forecast", icon: "🔮", section: "PLANNING" },
  { id: "budget-aop", label: "Budget / AOP", href: "/budget-aop", icon: "🎯", section: "PLANNING" },
  { id: "aop-pl", label: "AOP P&L", href: "/aop-pl", icon: "📋", section: "PLANNING" },
  { id: "aop-bs", label: "AOP Balance Sheet", href: "/aop-bs", icon: "🏛", section: "PLANNING" },
  { id: "aop-cfs", label: "AOP Cash Flow", href: "/aop-cfs", icon: "💵", section: "PLANNING" },
  { id: "allocation-rules", label: "Allocation Rules", href: "/allocation-rules", icon: "⚙️", section: "PLANNING" },
  { id: "journal-entries", label: "Journal Entries", href: "/journal-entries", icon: "📝", section: "LEDGER" },
  { id: "reconciliation", label: "Reconciliation", href: "/reconciliation", icon: "🔗", section: "LEDGER" },
  { id: "ledger-upload", label: "Ledger Upload", href: "/ledger-upload", icon: "⬆️", section: "LEDGER" },
  { id: "chart-of-accounts", label: "Chart of Accounts", href: "/chart-of-accounts", icon: "📂", section: "LEDGER" },
  { id: "insurance-market", label: "Insurance Market", href: "/insurance-market", icon: "🏛", section: "INTELLIGENCE" },
  { id: "board-reports", label: "Board Reports", href: "/board-reports", icon: "📑", section: "INTELLIGENCE" },
  { id: "users", label: "Users & Roles", href: "/users", icon: "👤", section: "ADMIN" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙️", section: "ADMIN" },
];

export default function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const initials = (userName || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  let lastSection = "";
  return (
    <aside className="fm-sidebar fixed left-0 top-0 bottom-0 w-[256px] flex flex-col z-[100]">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <Image
          src="/edme-logo.png"
          alt="Edme Insurance Brokers"
          width={160}
          height={40}
          priority
          style={{ filter: "brightness(0) invert(1)", opacity: 0.93, height: "32px", width: "auto" }}
        />
        <div className="mt-2 text-[14px] font-serif font-bold text-white tracking-tight leading-none">
          FINMIND <span style={{ color: "#ED1B2F" }}>AI</span>
        </div>
        <div className="text-[9px] tracking-[2px] uppercase text-white/30 mt-1">
          Edme MIS Platform · v1.0
        </div>
      </div>

      {/* User block */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-edred to-edred-600 flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-white truncate">{userName || "User"}</div>
          <div className="text-[9.5px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded inline-block mt-0.5 uppercase tracking-wider">
            {userRole || "Member"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const showSection = item.section !== lastSection;
          if (showSection) lastSection = item.section;
          return (
            <div key={item.id}>
              {showSection && (
                <div className="px-4 pt-3 pb-1 text-[9px] tracking-[2px] uppercase text-white/25 font-bold">
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                className={cn(
                  "fm-sb-item flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-[12.5px] font-medium",
                  active ? "active" : "text-white/55"
                )}
              >
                <span className="w-4 text-center text-[14px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-edgreen/30 bg-edgreen/10">
          <span className="w-1.5 h-1.5 rounded-full bg-edgreen animate-blink" />
          <span className="text-[10.5px] text-white/50">Books: Open · FY 2025-26</span>
        </div>
      </div>
    </aside>
  );
}
