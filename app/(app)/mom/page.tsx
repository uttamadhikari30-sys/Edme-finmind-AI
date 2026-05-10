import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import { formatINRUnit, formatPct, delta as pctDelta } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MoMPLPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;

  const { data: rows } = await supabase.rpc("fn_monthly_pl", { p_org_id: membership.org_id });
  const months = (rows ?? []).map((r: any) => ({
    period_label: r.period_label,
    revenue: Number(r.revenue),
    expense: Number(r.expense),
    net_income: Number(r.net_income),
  }));

  return (
    <>
      <PageHeader
        title="Month-on-Month P&L"
        subtitle="Period-over-period comparison · all posted journal entries"
      />

      <Card>
        <CardHeader title="Monthly summary" tag={{ label: `${months.length} periods`, tone: "navy" }} />
        <CardBody className="p-0">
          {months.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-subtle">
              No data yet. Post journal entries to populate this view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="r">Revenue</th>
                    <th className="r">Expense</th>
                    <th className="r">Net Income</th>
                    <th className="r">Margin %</th>
                    <th className="r">Δ vs Prev</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m: any, i: number) => {
                    const margin = m.revenue > 0 ? (m.net_income / m.revenue) * 100 : 0;
                    const prev = i > 0 ? months[i - 1] : null;
                    const dRev = prev ? pctDelta(m.revenue, prev.revenue) : 0;
                    return (
                      <tr key={m.period_label}>
                        <td className="font-semibold">{m.period_label}</td>
                        <td className="r font-mono">{formatINRUnit(m.revenue)}</td>
                        <td className="r font-mono">{formatINRUnit(m.expense)}</td>
                        <td
                          className={`r font-mono font-bold ${
                            m.net_income >= 0 ? "text-edgreen" : "text-edred"
                          }`}
                        >
                          {formatINRUnit(m.net_income)}
                        </td>
                        <td className="r font-mono">{m.revenue > 0 ? `${margin.toFixed(1)}%` : "—"}</td>
                        <td className={`r font-mono font-bold ${dRev > 0 ? "text-edgreen" : dRev < 0 ? "text-edred" : "text-ink-subtle"}`}>
                          {prev ? formatPct(dRev, 1) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
