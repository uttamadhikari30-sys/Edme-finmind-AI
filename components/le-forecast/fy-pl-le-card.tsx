"use client";

import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

type Line = {
  label: string;
  h1Act: number;
  h2LE: number;
  aop: number;
  isCost?: boolean;
  isTotal?: boolean;
};

export default function FYPLLeCard({ lines, fyLabel }: { lines: Line[]; fyLabel: string }) {
  const currency = useCurrency();

  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">📋 Full Year P&amp;L — LE vs AOP</h3>
        <span className="pill pill-green">{fyLabel}</span>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Line Item</th>
              <th className="r">H1 Act</th>
              <th className="r" style={{ color: "#00a878" }}>H2 LE</th>
              <th className="r">FY LE</th>
              <th className="r">AOP</th>
              <th className="r">Gap</th>
              <th className="r">%</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const fyLE = l.h1Act + l.h2LE;
              const gap = fyLE - l.aop;
              const pct = l.aop !== 0 ? (gap / Math.abs(l.aop)) * 100 : 0;
              const favorable = l.isCost ? gap <= 0 : gap >= 0;
              const gapColor = l.aop === 0 ? "text-ink-subtle" : favorable ? "text-edgreen" : "text-edred";

              return (
                <tr
                  key={i}
                  className={
                    l.isTotal ? "bg-edgreen-50/40 font-bold border-y-2 border-edgreen/30" : ""
                  }
                >
                  <td className={`${l.isTotal ? "text-navy uppercase tracking-[1px] text-[11px]" : "text-ink-muted"}`}>
                    {l.label}
                  </td>
                  <td className={`r font-mono ${l.isTotal ? "font-bold text-navy" : ""}`}>
                    {formatCurrencyLakhs(l.h1Act, currency)}
                  </td>
                  <td className={`r font-mono ${l.isTotal ? "font-bold" : ""}`} style={{ color: "#00a878" }}>
                    {formatCurrencyLakhs(l.h2LE, currency)}
                  </td>
                  <td className={`r font-mono ${l.isTotal ? "font-bold text-navy" : "text-navy"}`}>
                    {formatCurrencyLakhs(fyLE, currency)}
                  </td>
                  <td className="r font-mono text-ink-subtle">
                    {l.aop > 0 ? formatCurrencyLakhs(l.aop, currency) : "—"}
                  </td>
                  <td className={`r font-mono font-bold ${gapColor}`}>
                    {l.aop === 0 ? "—" : `${gap >= 0 ? "+" : ""}${compactLakhs(gap, currency)} ${currency.symbol}L`}
                  </td>
                  <td className={`r font-mono font-bold ${gapColor}`}>
                    {l.aop === 0 ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
