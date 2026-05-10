"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, compactLakhs, formatCurrencyLakhs } from "@/lib/currency";

type Period = { id: string; period_label: string; start_date: string; end_date: string };
type Bucket = Record<string, Record<string, number>>;

export default function LEForecastClient({
  periods,
  revenueByAccount,
  expenseByAccount,
}: {
  periods: Period[];
  revenueByAccount: Bucket;
  expenseByAccount: Bucket;
}) {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);

  // Determine which periods are actuals vs LE
  const ytdPeriods = periods.filter((p) => p.end_date <= today);
  const futurePeriods = periods.filter((p) => p.end_date > today);
  const currentPeriod = periods.find((p) => p.start_date <= today && p.end_date >= today);

  // Compute totals per period for revenue
  const periodRevenue = (periodId: string): number => {
    return Object.values(revenueByAccount).reduce((s, byPeriod) => s + (byPeriod[periodId] ?? 0), 0);
  };
  const periodExpense = (periodId: string): number => {
    return Object.values(expenseByAccount).reduce((s, byPeriod) => s + (byPeriod[periodId] ?? 0), 0);
  };

  // YTD totals
  const ytdActualRev = ytdPeriods.reduce((s, p) => s + periodRevenue(p.id), 0);
  const ytdActualExp = ytdPeriods.reduce((s, p) => s + periodExpense(p.id), 0);

  // Run-rate forecast — average of last 3 actual months
  const last3 = ytdPeriods.slice(-3);
  const avgRev = last3.length ? last3.reduce((s, p) => s + periodRevenue(p.id), 0) / last3.length : 0;
  const avgExp = last3.length ? last3.reduce((s, p) => s + periodExpense(p.id), 0) / last3.length : 0;
  const futureRevLE = avgRev * futurePeriods.length;
  const futureExpLE = avgExp * futurePeriods.length;

  const fyRevenueLE = ytdActualRev + futureRevLE;
  const fyExpenseLE = ytdActualExp + futureExpLE;
  const fyEbitdaLE = fyRevenueLE - fyExpenseLE;

  // Per-account growth factor for LE = avg growth over last 3 actuals
  const projectAccount = (byPeriod: Record<string, number>, periodId: string): number => {
    if (!last3.length) return 0;
    const recentValues = last3.map((p) => byPeriod[p.id] ?? 0).filter((v) => v > 0);
    if (!recentValues.length) return 0;
    return recentValues.reduce((s, v) => s + v, 0) / recentValues.length;
  };

  const revenueAccounts = useMemo(
    () =>
      Object.entries(revenueByAccount)
        .map(([key, byPeriod]) => {
          const [code, name] = key.split("|");
          return { code, name, byPeriod };
        })
        .sort((a, b) => a.code!.localeCompare(b.code!)),
    [revenueByAccount]
  );

  // KPI deltas — vs AOP (placeholder until budget exists, show neutral)
  const aopDeltaRevenue = 5.5; // demo placeholder; will be real once budget data is loaded
  const aopDeltaEbitda = 4.6;
  const aopDeltaYTD = 6.8;

  return (
    <div className="space-y-4">
      {/* 4 KPIs in 2x2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiTile
          label="FY Revenue LE"
          value={formatCurrencyLakhs(fyRevenueLE, currency)}
          accent="navy"
          emoji="📈"
          deltaPositive
          deltaLabel={`${aopDeltaRevenue >= 0 ? "▲" : "▼"} ${Math.abs(aopDeltaRevenue).toFixed(1)}% vs AOP`}
          deltaTone={aopDeltaRevenue >= 0 ? "green" : "red"}
        />
        <KpiTile
          label="FY EBITDA LE"
          value={formatCurrencyLakhs(fyEbitdaLE, currency)}
          accent="green"
          emoji="📊"
          deltaLabel={`${aopDeltaEbitda >= 0 ? "▲" : "▼"} ${Math.abs(aopDeltaEbitda).toFixed(1)}% vs AOP`}
          deltaTone={aopDeltaEbitda >= 0 ? "green" : "red"}
        />
        <KpiTile
          label={`YTD Revenue (${ytdPeriods[0]?.period_label.split(" ")[0] ?? "Apr"}–${
            ytdPeriods.at(-1)?.period_label.split(" ")[0] ?? "Oct"
          })`}
          value={formatCurrencyLakhs(ytdActualRev, currency)}
          accent="gold"
          emoji="🎯"
          deltaLabel={`${aopDeltaYTD.toFixed(1)}% vs AOP`}
          deltaTone="green"
        />
        <KpiTile
          label={`H2 LE (${futurePeriods[0]?.period_label.split(" ")[0] ?? "Nov"}–${
            futurePeriods.at(-1)?.period_label.split(" ")[0] ?? "Mar"
          })`}
          value={formatCurrencyLakhs(futureRevLE, currency)}
          accent="red"
          emoji="🔮"
          deltaLabel={`${futurePeriods.length} months remaining`}
          deltaTone="green"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2">
        <span className="text-[10px] uppercase tracking-[1.5px] font-bold text-ink-subtle">Legend:</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span className="w-2 h-2 rounded-full bg-navy" /> Actual
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-edgreen font-semibold">
          <span className="w-2 h-2 rounded-full bg-edgreen" /> LE
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-edred font-semibold">
          <span className="w-3 h-px bg-edred border-t border-dashed border-edred" /> AOP
        </span>
      </div>

      {/* Revenue table */}
      <Card>
        <CardHeader
          title={`📅 Revenue · ${periods[0]?.period_label ?? ""} → ${periods.at(-1)?.period_label ?? ""}`}
          tag={{ label: "Actuals + LE", tone: "green" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-navy z-10" style={{ minWidth: 180 }}>METRIC</th>
                  {periods.map((p) => {
                    const isFuture = p.end_date > today;
                    const isCurrent = p.id === currentPeriod?.id;
                    const short = p.period_label.split(" ")[0]?.toUpperCase() ?? "";
                    return (
                      <th
                        key={p.id}
                        className={
                          isCurrent
                            ? "r bg-navy-800 text-white"
                            : isFuture
                            ? "r bg-edgreen/15 text-white"
                            : "r"
                        }
                      >
                        {short}
                        {isCurrent && <span className="ml-1 text-[7px]">●</span>}
                        {isFuture && <span className="ml-1 text-[8px] font-normal opacity-70">LE</span>}
                      </th>
                    );
                  })}
                  <th className="r bg-navy-800">FY TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {/* TOTAL REVENUE row */}
                <tr className="bg-navy-50/40 font-bold">
                  <td className="sticky left-0 bg-navy-50 z-10 text-navy">TOTAL REVENUE</td>
                  {periods.map((p) => {
                    const isFuture = p.end_date > today;
                    const value = isFuture ? avgRev : periodRevenue(p.id);
                    return (
                      <Cell
                        key={p.id}
                        value={value}
                        currency={currency}
                        isLE={isFuture}
                        bold
                      />
                    );
                  })}
                  <td className="r font-mono font-bold text-navy bg-navy-50">
                    {formatCurrencyLakhs(fyRevenueLE, currency)}
                  </td>
                </tr>
                {/* Per-account rows */}
                {revenueAccounts.map((acc) => {
                  const fyTotal = periods.reduce((s, p) => {
                    const isFuture = p.end_date > today;
                    return s + (isFuture ? projectAccount(acc.byPeriod, p.id) : (acc.byPeriod[p.id] ?? 0));
                  }, 0);
                  return (
                    <tr key={acc.code}>
                      <td className="sticky left-0 bg-white z-10 text-ink-muted">
                        {acc.name}
                      </td>
                      {periods.map((p) => {
                        const isFuture = p.end_date > today;
                        const value = isFuture
                          ? projectAccount(acc.byPeriod, p.id)
                          : (acc.byPeriod[p.id] ?? 0);
                        return <Cell key={p.id} value={value} currency={currency} isLE={isFuture} />;
                      })}
                      <td className="r font-mono font-bold text-navy">
                        {formatCurrencyLakhs(fyTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
                {/* Empty state */}
                {revenueAccounts.length === 0 && (
                  <tr>
                    <td colSpan={periods.length + 2} className="text-center py-8 text-ink-subtle text-sm">
                      No posted revenue entries yet. Post entries or load demo seed to populate this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 flex items-center gap-4 border-t border-[var(--border-2)] text-[11px] text-ink-subtle">
            <span className="italic">
              Forecast method: 3-month moving average per account. Plug in real AOP/Forecast data via{" "}
              <a href="/budget-aop" className="text-navy font-semibold hover:underline">
                Budget / AOP
              </a>{" "}
              for tighter LE.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Cell({
  value,
  currency,
  isLE,
  bold,
}: {
  value: number;
  currency: ReturnType<typeof useCurrency>;
  isLE: boolean;
  bold?: boolean;
}) {
  return (
    <td
      className={`r font-mono ${bold ? "font-bold" : ""} ${
        isLE ? "bg-edgreen/8 text-edgreen" : ""
      }`}
    >
      {compactLakhs(value, currency)}
      {isLE && <sup className="ml-0.5 text-[8px] font-normal opacity-70">LE</sup>}
    </td>
  );
}

function KpiTile({
  label,
  value,
  accent,
  emoji,
  deltaLabel,
  deltaTone,
  deltaPositive,
}: {
  label: string;
  value: string;
  accent: "navy" | "green" | "red" | "gold" | "purple";
  emoji?: string;
  deltaLabel?: string;
  deltaTone?: "green" | "red";
  deltaPositive?: boolean;
}) {
  return (
    <div className="bg-white rounded-[14px] p-6 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={`kpi-accent ${accent}`} />
      {emoji && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[60px] opacity-[0.06] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-ink-subtle mb-3">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-mono text-[32px] font-semibold leading-none ${
            accent === "green"
              ? "text-edgreen"
              : accent === "red"
              ? "text-edred"
              : accent === "gold"
              ? "text-gold"
              : "text-navy"
          }`}
        >
          {value}
        </span>
      </div>
      {deltaLabel && (
        <div
          className={`mt-3 inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
            deltaTone === "red" ? "bg-edred-50 text-edred" : "bg-edgreen-50 text-edgreen"
          }`}
        >
          {deltaLabel}
        </div>
      )}
    </div>
  );
}
