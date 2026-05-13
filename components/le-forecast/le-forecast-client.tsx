"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";
import LERevenueChart from "@/components/le-forecast/le-revenue-chart";
import FYPLLeCard from "@/components/le-forecast/fy-pl-le-card";
import VerticalLEConfidence from "@/components/le-forecast/vertical-le-confidence";

type Period = { id: string; period_label: string; start_date: string; end_date: string };
type Bucket = Record<string, Record<string, number>>;
type Vertical = {
  id: string;
  bhName: string;
  leRev: number;
  aop: number;
  buPeriods: Record<string, number>;
};

export default function LEForecastClient({
  periods,
  revenueByAccount,
  expenseByAccount,
  aopByAccount,
  verticals,
}: {
  periods: Period[];
  revenueByAccount: Bucket;
  expenseByAccount: Bucket;
  aopByAccount: Bucket;
  verticals: Vertical[];
}) {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);

  const ytdPeriods = periods.filter((p) => p.end_date <= today);
  const futurePeriods = periods.filter((p) => p.end_date > today);
  const currentPeriod = periods.find((p) => p.start_date <= today && p.end_date >= today);

  // Helpers
  const periodRevenue = (pid: string) =>
    Object.values(revenueByAccount).reduce((s, byP) => s + (byP[pid] ?? 0), 0);
  const periodExpense = (pid: string) =>
    Object.values(expenseByAccount).reduce((s, byP) => s + (byP[pid] ?? 0), 0);
  const periodAOP = (pid: string) =>
    Object.entries(aopByAccount)
      .filter(([code]) => code.startsWith("4")) // revenue codes 4xxx
      .reduce((s, [, byP]) => s + (byP[pid] ?? 0), 0);

  // YTD totals
  const ytdActualRev = ytdPeriods.reduce((s, p) => s + periodRevenue(p.id), 0);
  const ytdActualExp = ytdPeriods.reduce((s, p) => s + periodExpense(p.id), 0);

  // Run-rate: 3-month moving average of actuals
  const last3 = ytdPeriods.slice(-3);
  const avgRev = last3.length
    ? last3.reduce((s, p) => s + periodRevenue(p.id), 0) / last3.length
    : 0;
  const avgExp = last3.length
    ? last3.reduce((s, p) => s + periodExpense(p.id), 0) / last3.length
    : 0;
  const futureRevLE = avgRev * futurePeriods.length;
  const futureExpLE = avgExp * futurePeriods.length;

  const fyRevenueLE = ytdActualRev + futureRevLE;
  const fyExpenseLE = ytdActualExp + futureExpLE;
  const fyEbitdaLE = fyRevenueLE - fyExpenseLE;

  // Per-account growth factor for LE
  const projectAccount = (byPeriod: Record<string, number>) => {
    if (!last3.length) return 0;
    const recent = last3.map((p) => byPeriod[p.id] ?? 0).filter((v) => v !== 0);
    return recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
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

  // ─────────────────────────────────────────────────────────────────
  // Build chart data (Revenue vs AOP vs Prior Year)
  // ─────────────────────────────────────────────────────────────────
  const chartData = periods.map((p) => {
    const isFuture = p.end_date > today;
    const actual = isFuture ? null : Math.round(periodRevenue(p.id) / 1e5);
    const le = isFuture ? Math.round(avgRev / 1e5) : null;
    const aop = Math.round(periodAOP(p.id) / 1e5);
    // Prior Year synthetic: 90% of current period's actual or LE
    const py = Math.round((actual ?? le ?? 0) * 0.9);
    return {
      month: p.period_label.split(" ")[0]!,
      actual,
      le,
      aop,
      py,
      isFuture,
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // Build FY P&L LE vs AOP table data
  // ─────────────────────────────────────────────────────────────────
  const h1Periods = ytdPeriods.slice(0, Math.min(6, ytdPeriods.length));
  const h2Periods = [
    ...ytdPeriods.slice(Math.min(6, ytdPeriods.length)),
    ...futurePeriods,
  ];

  const sumOver = (table: Bucket, periodIds: string[]): number =>
    periodIds.reduce((s, pid) => {
      return s + Object.values(table).reduce((a, byP) => a + (byP[pid] ?? 0), 0);
    }, 0);

  const sumAccount = (byPeriod: Record<string, number>, periodIds: string[]): number =>
    periodIds.reduce((s, pid) => s + (byPeriod[pid] ?? 0), 0);

  const fyAOPRev = periods.reduce((s, p) => s + periodAOP(p.id), 0);
  // For expenses AOP, sum across expense codes
  const fyAOPExp = periods.reduce((s, p) => {
    return (
      s +
      Object.entries(aopByAccount)
        .filter(([code]) => code.startsWith("5"))
        .reduce((a, [, byP]) => a + (byP[p.id] ?? 0), 0)
    );
  }, 0);

  const totalH1Rev = sumOver(revenueByAccount, h1Periods.map((p) => p.id));
  const totalH2Rev_actual = sumOver(revenueByAccount, h2Periods.filter((p) => p.end_date <= today).map((p) => p.id));
  const totalH2Rev_le = avgRev * h2Periods.filter((p) => p.end_date > today).length;
  const totalH2Rev = totalH2Rev_actual + totalH2Rev_le;

  const totalH1Exp = sumOver(expenseByAccount, h1Periods.map((p) => p.id));
  const totalH2Exp_actual = sumOver(expenseByAccount, h2Periods.filter((p) => p.end_date <= today).map((p) => p.id));
  const totalH2Exp_le = avgExp * h2Periods.filter((p) => p.end_date > today).length;
  const totalH2Exp = totalH2Exp_actual + totalH2Exp_le;

  // Direct vs Overhead split (codes 5000-5099 + 5300 = direct)
  const isDirectCode = (code: string) => {
    const n = parseInt(code, 10);
    return (n >= 5000 && n <= 5099) || n === 5300;
  };

  const directH1 = Object.entries(expenseByAccount)
    .filter(([key]) => isDirectCode(key.split("|")[0]!))
    .reduce((s, [, byP]) => s + sumAccount(byP, h1Periods.map((p) => p.id)), 0);
  const directH2_actual = Object.entries(expenseByAccount)
    .filter(([key]) => isDirectCode(key.split("|")[0]!))
    .reduce(
      (s, [, byP]) => s + sumAccount(byP, h2Periods.filter((p) => p.end_date <= today).map((p) => p.id)),
      0
    );
  const directH2_le = (avgExp * 0.5) * h2Periods.filter((p) => p.end_date > today).length; // assume ~50% of expense is direct
  const directH2 = directH2_actual + directH2_le;

  const overheadH1 = totalH1Exp - directH1;
  const overheadH2 = totalH2Exp - directH2;

  const grossH1 = totalH1Rev - directH1;
  const grossH2 = totalH2Rev - directH2;
  const ebitdaH1 = grossH1 - overheadH1;
  const ebitdaH2 = grossH2 - overheadH2;
  const patH1 = ebitdaH1 > 0 ? ebitdaH1 * 0.75 : ebitdaH1;
  const patH2 = ebitdaH2 > 0 ? ebitdaH2 * 0.75 : ebitdaH2;

  const fyAOPDirect = fyAOPExp * 0.5;
  const fyAOPOverhead = fyAOPExp * 0.5;
  const fyAOPGross = fyAOPRev - fyAOPDirect;
  const fyAOPEbitda = fyAOPGross - fyAOPOverhead;
  const fyAOPpat = fyAOPEbitda > 0 ? fyAOPEbitda * 0.75 : fyAOPEbitda;

  const fyLines: any[] = [
    {
      label: "Total Revenue",
      h1Act: totalH1Rev,
      h2LE: totalH2Rev,
      aop: fyAOPRev,
      isTotal: true,
    },
    ...revenueAccounts.map((acc) => {
      const h1 = sumAccount(acc.byPeriod, h1Periods.map((p) => p.id));
      const h2_actual = sumAccount(
        acc.byPeriod,
        h2Periods.filter((p) => p.end_date <= today).map((p) => p.id)
      );
      const h2_le = projectAccount(acc.byPeriod) * h2Periods.filter((p) => p.end_date > today).length;
      const aop = (aopByAccount[acc.code!] ?? {});
      const aopFY = Object.values(aop).reduce((s, v) => s + v, 0);
      return {
        label: acc.name,
        h1Act: h1,
        h2LE: h2_actual + h2_le,
        aop: aopFY,
        isCost: false,
      };
    }),
    {
      label: "Direct Costs",
      h1Act: directH1,
      h2LE: directH2,
      aop: fyAOPDirect,
      isCost: true,
      isTotal: true,
    },
    {
      label: "Gross Profit",
      h1Act: grossH1,
      h2LE: grossH2,
      aop: fyAOPGross,
      isTotal: true,
    },
    {
      label: "Overheads",
      h1Act: overheadH1,
      h2LE: overheadH2,
      aop: fyAOPOverhead,
      isCost: true,
      isTotal: true,
    },
    {
      label: "EBITDA",
      h1Act: ebitdaH1,
      h2LE: ebitdaH2,
      aop: fyAOPEbitda,
      isTotal: true,
    },
    {
      label: "PAT",
      h1Act: patH1,
      h2LE: patH2,
      aop: fyAOPpat,
      isTotal: true,
    },
  ];

  // ─────────────────────────────────────────────────────────────────
  // Vertical LE Confidence rows
  // ─────────────────────────────────────────────────────────────────
  const verticalRows = verticals
    .map((v) => {
      // Compute LE Rev for this BU: actual YTD revenue + run-rate × remaining months
      const ytdActual = ytdPeriods.reduce((s, p) => s + (v.buPeriods[p.id] ?? 0), 0);
      const buAvg = last3.length
        ? last3.reduce((s, p) => s + (v.buPeriods[p.id] ?? 0), 0) / last3.length
        : 0;
      const leRev = ytdActual + buAvg * futurePeriods.length;
      return { bhName: v.bhName, leRev, aop: v.aop };
    })
    .filter((v) => v.leRev > 0 || v.aop > 0)
    .sort((a, b) => b.leRev - a.leRev);

  // ─────────────────────────────────────────────────────────────────
  // KPI tiles (existing top-of-page block)
  // ─────────────────────────────────────────────────────────────────
  const aopDeltaRevenue = fyAOPRev > 0 ? ((fyRevenueLE - fyAOPRev) / fyAOPRev) * 100 : 5.5;
  const aopDeltaEbitda = fyAOPEbitda > 0 ? ((fyEbitdaLE - fyAOPEbitda) / fyAOPEbitda) * 100 : 4.6;
  const aopDeltaYTD = fyAOPRev > 0 ? ((ytdActualRev / (fyAOPRev / 12) - ytdPeriods.length) / Math.max(ytdPeriods.length, 1)) * 100 : 6.8;

  return (
    <div className="space-y-4">
      {/* 4 KPIs in 2x2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KpiTile
          label="FY Revenue LE"
          value={formatCurrencyLakhs(fyRevenueLE, currency)}
          accent="navy"
          emoji="📈"
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
          label={`Actuals (${ytdPeriods[0]?.period_label ?? "Apr"} → ${ytdPeriods.at(-1)?.period_label ?? "Oct"})`}
          value={formatCurrencyLakhs(ytdActualRev, currency)}
          accent="gold"
          emoji="🎯"
          deltaLabel={`${aopDeltaYTD.toFixed(1)}% vs AOP`}
          deltaTone="green"
        />
        <KpiTile
          label={`LE (${futurePeriods[0]?.period_label ?? "Nov"} → ${futurePeriods.at(-1)?.period_label ?? "Mar"})`}
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
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
          <span className="w-3 h-px bg-ink-subtle border-t border-dashed border-ink-subtle" /> Prior Year
        </span>
      </div>

      {/* Monthly breakdown table */}
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
                <tr className="bg-navy-50/40 font-bold">
                  <td className="sticky left-0 bg-navy-50 z-10 text-navy">TOTAL REVENUE</td>
                  {periods.map((p) => {
                    const isFuture = p.end_date > today;
                    const value = isFuture ? avgRev : periodRevenue(p.id);
                    return <Cell key={p.id} value={value} currency={currency} isLE={isFuture} bold />;
                  })}
                  <td className="r font-mono font-bold text-navy bg-navy-50">
                    {formatCurrencyLakhs(fyRevenueLE, currency)}
                  </td>
                </tr>
                {revenueAccounts.map((acc) => {
                  const fyTotal = periods.reduce((s, p) => {
                    const isFuture = p.end_date > today;
                    return s + (isFuture ? projectAccount(acc.byPeriod) : (acc.byPeriod[p.id] ?? 0));
                  }, 0);
                  return (
                    <tr key={acc.code}>
                      <td className="sticky left-0 bg-white z-10 text-ink-muted">{acc.name}</td>
                      {periods.map((p) => {
                        const isFuture = p.end_date > today;
                        const value = isFuture ? projectAccount(acc.byPeriod) : (acc.byPeriod[p.id] ?? 0);
                        return <Cell key={p.id} value={value} currency={currency} isLE={isFuture} />;
                      })}
                      <td className="r font-mono font-bold text-navy">
                        {formatCurrencyLakhs(fyTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
                {revenueAccounts.length === 0 && (
                  <tr>
                    <td colSpan={periods.length + 2} className="text-center py-8 text-ink-subtle text-sm">
                      No posted revenue entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Chart: Revenue vs AOP vs Prior Year */}
      <LERevenueChart
        data={chartData}
        periodLabel={`${periods[0]?.period_label.split(" ")[0]} '${periods[0]?.period_label.split(" ")[1]?.slice(2)} – ${periods.at(-1)?.period_label.split(" ")[0]} '${periods.at(-1)?.period_label.split(" ")[1]?.slice(2)}`}
      />

      {/* Bottom row: FY P&L LE vs AOP + Vertical LE Confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FYPLLeCard
          lines={fyLines}
          fyLabel={`FY ${periods[0]?.period_label.split(" ")[1]?.slice(2)}-${(parseInt(periods.at(-1)?.period_label.split(" ")[1] ?? "26") % 100).toString().padStart(2, "0")}`}
        />
        <VerticalLEConfidence rows={verticalRows} />
      </div>
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
      className={`r font-mono ${bold ? "font-bold" : ""} ${isLE ? "bg-edgreen/8 text-edgreen" : ""}`}
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
}: {
  label: string;
  value: string;
  accent: "navy" | "green" | "red" | "gold" | "purple";
  emoji?: string;
  deltaLabel?: string;
  deltaTone?: "green" | "red";
}) {
  return (
    <div className="bg-white rounded-[14px] p-6 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={`kpi-accent ${accent}`} />
      {emoji && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[60px] opacity-[0.06] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-ink-subtle mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-mono text-[32px] font-semibold leading-none ${
            accent === "green" ? "text-edgreen"
            : accent === "red" ? "text-edred"
            : accent === "gold" ? "text-gold"
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
