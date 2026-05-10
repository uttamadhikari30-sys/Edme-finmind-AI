"use client";

import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

type Row = {
  bhName: string;
  leRev: number;
  aop: number;
  // Confidence is computed from gap %: <10% → High, 10-20% → Med, >20% → Low
};

function confidenceFor(leRev: number, aop: number): { label: string; tone: "green" | "gold" | "red" } {
  if (aop === 0) return { label: "—", tone: "gold" };
  const pct = Math.abs((leRev - aop) / aop) * 100;
  if (pct <= 10) return { label: "High", tone: "green" };
  if (pct <= 20) return { label: "Med", tone: "gold" };
  return { label: "Low", tone: "red" };
}

export default function VerticalLEConfidence({ rows }: { rows: Row[] }) {
  const currency = useCurrency();
  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">
          👥 Vertical LE Confidence
        </h3>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="fm-table">
          <thead>
            <tr>
              <th>Business Head</th>
              <th className="r" style={{ color: "#00a878" }}>LE Rev</th>
              <th className="r">AOP</th>
              <th className="r">Gap</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const gap = r.leRev - r.aop;
              const conf = confidenceFor(r.leRev, r.aop);
              const dotColor =
                conf.tone === "green" ? "bg-edgreen" : conf.tone === "gold" ? "bg-gold" : "bg-edred";
              return (
                <tr key={i}>
                  <td className="font-semibold">{r.bhName}</td>
                  <td className="r font-mono" style={{ color: "#00a878" }}>
                    {formatCurrencyLakhs(r.leRev, currency)}
                  </td>
                  <td className="r font-mono text-ink-subtle">
                    {r.aop > 0 ? formatCurrencyLakhs(r.aop, currency) : "—"}
                  </td>
                  <td className={`r font-mono font-bold ${gap >= 0 ? "text-edgreen" : "text-edred"}`}>
                    {r.aop === 0 ? "—" : `${gap >= 0 ? "+" : ""}${compactLakhs(gap, currency)} ${currency.symbol}L`}
                  </td>
                  <td>
                    <span className={`flex items-center gap-1.5 font-semibold text-[11.5px] ${
                      conf.tone === "green" ? "text-edgreen" : conf.tone === "gold" ? "text-gold" : "text-edred"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} /> {conf.label}
                    </span>
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
