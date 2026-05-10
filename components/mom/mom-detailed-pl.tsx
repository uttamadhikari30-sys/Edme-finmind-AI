"use client";

import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";

type Period = { id: string; period_label: string; start_date: string; end_date: string };
type Bucket = Record<string, Record<string, number>>;

export default function MoMDetailedPL({
  periods,
  revenueByAccount,
  expenseByAccount,
  aopByAccount,
}: {
  periods: Period[];
  revenueByAccount: Bucket;
  expenseByAccount: Bucket;
  aopByAccount: Bucket;
}) {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);

  const revenueAccounts = Object.entries(revenueByAccount)
    .map(([key, byPeriod]) => {
      const [code, name] = key.split("|");
      return { code, name, byPeriod };
    })
    .sort((a, b) => a.code!.localeCompare(b.code!));

  const expenseAccounts = Object.entries(expenseByAccount)
    .map(([key, byPeriod]) => {
      const [code, name] = key.split("|");
      return { code, name, byPeriod };
    })
    .sort((a, b) => a.code!.localeCompare(b.code!));

  const periodRevenue = (pid: string) =>
    Object.values(revenueByAccount).reduce((s, byP) => s + (byP[pid] ?? 0), 0);
  const periodExpense = (pid: string) =>
    Object.values(expenseByAccount).reduce((s, byP) => s + (byP[pid] ?? 0), 0);

  // YTD
  const ytdPeriods = periods.filter((p) => p.end_date <= today);
  const accountYTD = (byPeriod: Record<string, number>) =>
    ytdPeriods.reduce((s, p) => s + (byPeriod[p.id] ?? 0), 0);
  const accountAOP = (code: string) => {
    const byP = aopByAccount[code] ?? {};
    return periods.reduce((s, p) => s + (byP[p.id] ?? 0), 0);
  };

  const totalRevYTD = ytdPeriods.reduce((s, p) => s + periodRevenue(p.id), 0);
  const totalExpYTD = ytdPeriods.reduce((s, p) => s + periodExpense(p.id), 0);
  const grossYTD = totalRevYTD - totalExpYTD;
  const ebitdaYTD = grossYTD;
  const patYTD = ebitdaYTD > 0 ? ebitdaYTD * 0.75 : ebitdaYTD;
  const ebitdaMarginYTD = totalRevYTD > 0 ? (ebitdaYTD / totalRevYTD) * 100 : 0;

  const totalRevAOP = Object.entries(aopByAccount)
    .filter(([code]) => code.startsWith("4"))
    .reduce((s, [, byP]) => s + Object.values(byP).reduce((a, v) => a + v, 0), 0);
  const totalExpAOP = Object.entries(aopByAccount)
    .filter(([code]) => code.startsWith("5"))
    .reduce((s, [, byP]) => s + Object.values(byP).reduce((a, v) => a + v, 0), 0);
  const grossAOP = totalRevAOP - totalExpAOP;
  const ebitdaAOP = grossAOP;
  const patAOP = ebitdaAOP > 0 ? ebitdaAOP * 0.75 : ebitdaAOP;

  return (
    <div className="bg-white rounded-[14px] border border-[var(--border)] shadow-soft overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-2)]">
        <h3 className="font-serif text-[15.5px] font-bold text-navy flex-1">
          Month-on-Month Detailed P&amp;L
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="fm-table">
          <thead>
            <tr>
              <th className="sticky left-0 bg-navy z-10" style={{ minWidth: 160 }}>Metric</th>
              {periods.map((p) => {
                const short = p.period_label.split(" ")[0]!;
                return <th key={p.id} className="r">{short}</th>;
              })}
              <th className="r">YTD</th>
              <th className="r">AOP</th>
              <th className="r">vs AOP</th>
            </tr>
          </thead>
          <tbody>
            {/* TOTAL REVENUE */}
            <SectionRow
              label="TOTAL REVENUE"
              periods={periods}
              valueFn={(pid) => periodRevenue(pid)}
              ytd={totalRevYTD}
              aop={totalRevAOP}
              tone="green"
              currency={currency}
              today={today}
            />
            {revenueAccounts.map((acc) => (
              <DetailRow
                key={acc.code}
                label={acc.name}
                periods={periods}
                valueFn={(pid) => acc.byPeriod[pid] ?? 0}
                ytd={accountYTD(acc.byPeriod)}
                aop={accountAOP(acc.code!)}
                tone="green"
                currency={currency}
                today={today}
              />
            ))}

            {/* TOTAL EXPENSE */}
            <SectionRow
              label="TOTAL EXPENSE"
              periods={periods}
              valueFn={(pid) => periodExpense(pid)}
              ytd={totalExpYTD}
              aop={totalExpAOP}
              tone="red"
              currency={currency}
              today={today}
              isCost
            />
            {expenseAccounts.map((acc) => (
              <DetailRow
                key={acc.code}
                label={acc.name}
                periods={periods}
                valueFn={(pid) => acc.byPeriod[pid] ?? 0}
                ytd={accountYTD(acc.byPeriod)}
                aop={accountAOP(acc.code!)}
                tone="red"
                currency={currency}
                today={today}
                isCost
              />
            ))}

            {/* GROSS PROFIT, EBITDA, MARGIN, PAT */}
            <SectionRow
              label="GROSS PROFIT"
              periods={periods}
              valueFn={(pid) => periodRevenue(pid) - periodExpense(pid)}
              ytd={grossYTD}
              aop={grossAOP}
              tone="navy"
              currency={currency}
              today={today}
            />
            <SectionRow
              label="EBITDA"
              periods={periods}
              valueFn={(pid) => periodRevenue(pid) - periodExpense(pid)}
              ytd={ebitdaYTD}
              aop={ebitdaAOP}
              tone="navy"
              currency={currency}
              today={today}
            />
            <tr className="bg-edgreen-50/40">
              <td className="sticky left-0 bg-edgreen-50 z-10 font-bold text-edgreen text-[11px] uppercase tracking-[1px]">
                EBITDA Margin %
              </td>
              {periods.map((p) => {
                const r = periodRevenue(p.id);
                const e = periodExpense(p.id);
                const m = r > 0 ? ((r - e) / r) * 100 : 0;
                const isFuture = p.end_date > today;
                return (
                  <td key={p.id} className={`r font-mono font-bold ${isFuture ? "text-ink-subtle" : "text-edgreen"}`}>
                    {r > 0 ? `${m.toFixed(1)}%` : "—"}
                  </td>
                );
              })}
              <td className="r font-mono font-bold text-edgreen">{ebitdaMarginYTD.toFixed(1)}%</td>
              <td className="r font-mono text-ink-subtle">—</td>
              <td className="r font-mono text-ink-subtle">—</td>
            </tr>

            <SectionRow
              label="PAT (Est.)"
              periods={periods}
              valueFn={(pid) => {
                const v = periodRevenue(pid) - periodExpense(pid);
                return v > 0 ? v * 0.75 : v;
              }}
              ytd={patYTD}
              aop={patAOP}
              tone="navy"
              currency={currency}
              today={today}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRow({
  label,
  periods,
  valueFn,
  ytd,
  aop,
  tone,
  currency,
  today,
  isCost,
}: {
  label: string;
  periods: Period[];
  valueFn: (pid: string) => number;
  ytd: number;
  aop: number;
  tone: "green" | "red" | "navy";
  currency: ReturnType<typeof useCurrency>;
  today: string;
  isCost?: boolean;
}) {
  const variance = ytd - aop;
  const favorable = isCost ? variance <= 0 : variance >= 0;
  const colorClass =
    tone === "green" ? "text-edgreen" : tone === "red" ? "text-edred" : "text-navy";
  return (
    <tr className="bg-bg-alt font-bold border-t border-[var(--border-2)]">
      <td className={`sticky left-0 bg-bg-alt z-10 ${colorClass} text-[12px]`}>{label}</td>
      {periods.map((p) => {
        const v = valueFn(p.id);
        const isFuture = p.end_date > today;
        return (
          <td key={p.id} className={`r font-mono font-bold ${isFuture ? "text-ink-subtle" : colorClass}`}>
            {isFuture ? "—" : compactLakhs(v, currency)}
          </td>
        );
      })}
      <td className={`r font-mono font-bold ${colorClass}`}>
        {formatCurrencyLakhs(ytd, currency)}
      </td>
      <td className="r font-mono text-ink-subtle">
        {aop > 0 ? formatCurrencyLakhs(aop, currency) : "—"}
      </td>
      <td className={`r font-mono font-bold ${aop === 0 ? "text-ink-subtle" : favorable ? "text-edgreen" : "text-edred"}`}>
        {aop === 0 ? "—" : `${variance >= 0 ? "+" : ""}${compactLakhs(variance, currency)} ${currency.symbol}L`}
      </td>
    </tr>
  );
}

function DetailRow({
  label,
  periods,
  valueFn,
  ytd,
  aop,
  tone,
  currency,
  today,
  isCost,
}: {
  label: string;
  periods: Period[];
  valueFn: (pid: string) => number;
  ytd: number;
  aop: number;
  tone: "green" | "red";
  currency: ReturnType<typeof useCurrency>;
  today: string;
  isCost?: boolean;
}) {
  const variance = ytd - aop;
  const favorable = isCost ? variance <= 0 : variance >= 0;
  const colorClass = tone === "green" ? "text-edgreen" : "text-edred";
  return (
    <tr>
      <td className="sticky left-0 bg-white z-10 text-ink-muted">{label}</td>
      {periods.map((p) => {
        const v = valueFn(p.id);
        const isFuture = p.end_date > today;
        return (
          <td key={p.id} className={`r font-mono ${isFuture ? "text-ink-subtle" : colorClass}`}>
            {isFuture ? "—" : compactLakhs(v, currency)}
          </td>
        );
      })}
      <td className={`r font-mono ${colorClass}`}>{formatCurrencyLakhs(ytd, currency)}</td>
      <td className="r font-mono text-ink-subtle">
        {aop > 0 ? formatCurrencyLakhs(aop, currency) : "—"}
      </td>
      <td className={`r font-mono ${aop === 0 ? "text-ink-subtle" : favorable ? "text-edgreen" : "text-edred"}`}>
        {aop === 0 ? "—" : `${variance >= 0 ? "+" : ""}${compactLakhs(variance, currency)} ${currency.symbol}L`}
      </td>
    </tr>
  );
}
