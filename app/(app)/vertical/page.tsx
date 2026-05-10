import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINRUnit } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VerticalPage() {
  await requireUser();
  const supabase = createClient();
  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const { data: bus } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .order("code");

  // Aggregate posted JE lines by business unit
  const { data: jelRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_type),
      journal_entries!inner(status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  const byBu = new Map<string, { revenue: number; expense: number }>();
  (jelRows ?? []).forEach((row: any) => {
    const buId: string | null = row.business_unit_id;
    if (!buId) return;
    const t = row.chart_of_accounts?.account_type;
    const existing = byBu.get(buId) ?? { revenue: 0, expense: 0 };
    if (t === "revenue") existing.revenue += Number(row.credit_amount) - Number(row.debit_amount);
    if (t === "expense") existing.expense += Number(row.debit_amount) - Number(row.credit_amount);
    byBu.set(buId, existing);
  });

  const verticals = (bus ?? []).map((b: any) => {
    const v = byBu.get(b.id) ?? { revenue: 0, expense: 0 };
    return {
      code: b.code,
      name: b.name,
      revenue: v.revenue,
      expense: v.expense,
      margin: v.revenue > 0 ? ((v.revenue - v.expense) / v.revenue) * 100 : 0,
      net: v.revenue - v.expense,
    };
  });

  const totalRev = verticals.reduce((s, v) => s + v.revenue, 0);

  return (
    <>
      <PageHeader
        title="Vertical Performance"
        subtitle="Revenue, expense, and margin by business unit · all posted entries"
      />

      <Card>
        <CardHeader title="Verticals" tag={{ label: `${verticals.length} units`, tone: "navy" }} />
        <CardBody className="p-0">
          {verticals.length === 0 ? (
            <EmptyState title="No verticals" body="Verticals are seeded automatically during onboarding." />
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Vertical</th>
                  <th className="r">Revenue</th>
                  <th className="r">Expense</th>
                  <th className="r">Net</th>
                  <th className="r">Margin %</th>
                  <th className="r">Share %</th>
                </tr>
              </thead>
              <tbody>
                {verticals
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((v) => {
                    const share = totalRev > 0 ? (v.revenue / totalRev) * 100 : 0;
                    return (
                      <tr key={v.code}>
                        <td><span className="pill pill-navy">{v.code}</span></td>
                        <td className="font-semibold">{v.name}</td>
                        <td className="r font-mono">{formatINRUnit(v.revenue)}</td>
                        <td className="r font-mono">{formatINRUnit(v.expense)}</td>
                        <td className={`r font-mono font-bold ${v.net >= 0 ? "text-edgreen" : "text-edred"}`}>
                          {formatINRUnit(v.net)}
                        </td>
                        <td className="r font-mono">{v.revenue > 0 ? `${v.margin.toFixed(1)}%` : "—"}</td>
                        <td className="r font-mono text-ink-subtle">{share.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
