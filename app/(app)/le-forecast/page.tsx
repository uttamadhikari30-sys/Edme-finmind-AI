import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import { formatINRUnit, formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LEForecastPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  // Get all 12 fiscal periods
  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date")
    .eq("org_id", orgId)
    .order("start_date");

  const today = new Date().toISOString().slice(0, 10);
  const ytdPeriods = (periods ?? []).filter((p) => p.end_date <= today);
  const futurePeriods = (periods ?? []).filter((p) => p.end_date > today);

  // Actuals from monthly_pl RPC
  const { data: monthlyRaw } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
  const monthly = (monthlyRaw ?? []) as Array<{
    period_id: string;
    period_label: string;
    revenue: number;
    expense: number;
    net_income: number;
  }>;

  // YTD actuals
  const ytdActualRev = monthly
    .filter((m) => ytdPeriods.find((p) => p.id === m.period_id))
    .reduce((s, m) => s + Number(m.revenue), 0);
  const ytdActualExp = monthly
    .filter((m) => ytdPeriods.find((p) => p.id === m.period_id))
    .reduce((s, m) => s + Number(m.expense), 0);

  // Simple LE: extrapolate run-rate from last 3 months
  const last3 = monthly.slice(-3);
  const avgRev = last3.reduce((s, m) => s + Number(m.revenue), 0) / Math.max(last3.length, 1);
  const avgExp = last3.reduce((s, m) => s + Number(m.expense), 0) / Math.max(last3.length, 1);

  const futureRevLE = avgRev * futurePeriods.length;
  const futureExpLE = avgExp * futurePeriods.length;

  const fyRevenueLE = ytdActualRev + futureRevLE;
  const fyExpenseLE = ytdActualExp + futureExpLE;
  const fyEbitdaLE = fyRevenueLE - fyExpenseLE;

  // For comparison vs AOP — placeholder until budget exists
  const aopRevenue = 0;
  const aopEbitda = 0;
  const vsAOP_rev = aopRevenue > 0 ? ((fyRevenueLE - aopRevenue) / aopRevenue) * 100 : 0;
  const vsAOP_ebitda = aopEbitda > 0 ? ((fyEbitdaLE - aopEbitda) / aopEbitda) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Latest Estimate — Month on Month"
        subtitle={`Actuals (${ytdPeriods[0]?.period_label ?? "—"} → ${
          ytdPeriods.at(-1)?.period_label ?? "—"
        }) → Future LE · Full Year View`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <KpiTile
          label="FY Revenue LE"
          value={formatINRUnit(fyRevenueLE)}
          tone="navy"
          emoji="📈"
          delta={aopRevenue > 0 ? { value: vsAOP_rev, label: "vs AOP" } : undefined}
        />
        <KpiTile
          label="FY EBITDA LE"
          value={formatINRUnit(fyEbitdaLE)}
          tone={fyEbitdaLE >= 0 ? "green" : "red"}
          emoji="📊"
          delta={aopEbitda > 0 ? { value: vsAOP_ebitda, label: "vs AOP" } : undefined}
        />
        <KpiTile
          label={`YTD Revenue (${ytdPeriods.length} mo)`}
          value={formatINRUnit(ytdActualRev)}
          tone="gold"
          emoji="🎯"
          sub="Posted entries"
        />
        <KpiTile
          label={`Future LE (${futurePeriods.length} mo)`}
          value={formatINRUnit(futureRevLE)}
          tone="purple"
          emoji="🔮"
          sub={`${futurePeriods.length} months remaining`}
        />
      </div>

      <Card>
        <CardHeader
          title={`Revenue · ${periods?.[0]?.period_label ?? ""} → ${periods?.at(-1)?.period_label ?? ""}`}
          tag={{ label: "Actuals + LE", tone: "green" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Type</th>
                  <th className="r">Revenue</th>
                  <th className="r">Expense</th>
                  <th className="r">EBITDA</th>
                  <th className="r">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {(periods ?? []).map((p) => {
                  const actual = monthly.find((m) => m.period_id === p.id);
                  const isFuture = p.end_date > today;
                  const rev = isFuture ? avgRev : Number(actual?.revenue ?? 0);
                  const exp = isFuture ? avgExp : Number(actual?.expense ?? 0);
                  const ebitda = rev - exp;
                  const margin = rev > 0 ? (ebitda / rev) * 100 : 0;
                  return (
                    <tr key={p.id} className={isFuture ? "bg-edgreen-50/30" : ""}>
                      <td className="font-semibold">{p.period_label}</td>
                      <td>
                        <span className={`pill ${isFuture ? "pill-green" : "pill-navy"}`}>
                          {isFuture ? "LE" : "Actual"}
                        </span>
                      </td>
                      <td className="r font-mono">{formatINRUnit(rev)}</td>
                      <td className="r font-mono">{formatINRUnit(exp)}</td>
                      <td className={`r font-mono font-bold ${ebitda >= 0 ? "text-edgreen" : "text-edred"}`}>
                        {formatINRUnit(ebitda)}
                      </td>
                      <td className="r font-mono">{rev > 0 ? `${margin.toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-navy-50/60 font-bold">
                  <td colSpan={2} className="text-right text-[11px] uppercase text-navy">
                    FY TOTAL (Actual + LE)
                  </td>
                  <td className="r font-mono text-navy">{formatINRUnit(fyRevenueLE)}</td>
                  <td className="r font-mono text-navy">{formatINRUnit(fyExpenseLE)}</td>
                  <td className={`r font-mono ${fyEbitdaLE >= 0 ? "text-edgreen" : "text-edred"}`}>
                    {formatINRUnit(fyEbitdaLE)}
                  </td>
                  <td className="r font-mono text-navy">
                    {fyRevenueLE > 0 ? `${((fyEbitdaLE / fyRevenueLE) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 flex items-center gap-4 border-t border-[var(--border-2)] text-[11px] text-ink-subtle">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-navy" /> Actual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-edgreen" /> LE (forecast)
            </span>
            <span className="ml-auto italic">
              Forecast method: 3-month moving average run-rate. Refine with AOP for tighter estimate.
            </span>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function KpiTile({
  label,
  value,
  tone,
  emoji,
  delta,
  sub,
}: {
  label: string;
  value: string;
  tone: "navy" | "red" | "green" | "gold" | "purple";
  emoji?: string;
  delta?: { value: number; label: string };
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${tone}`} />
      {emoji && (
        <div className="absolute right-3 bottom-3 text-[40px] opacity-[0.07] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle mb-2">
        {label}
      </div>
      <div
        className={`font-mono text-[24px] font-semibold leading-none ${
          tone === "green"
            ? "text-edgreen"
            : tone === "red"
            ? "text-edred"
            : tone === "gold"
            ? "text-gold"
            : tone === "purple"
            ? "text-edpurple"
            : "text-navy"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              delta.value >= 0 ? "bg-edgreen-50 text-edgreen" : "bg-edred-50 text-edred"
            }`}
          >
            {delta.value >= 0 ? "▲" : "▼"} {formatPct(Math.abs(delta.value), 1)} {delta.label}
          </span>
        )}
        {sub && <span className="text-[10.5px] text-ink-subtle">{sub}</span>}
      </div>
    </div>
  );
}
